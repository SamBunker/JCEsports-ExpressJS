const { 
    addOrUpdateInvitation,
    getInvitationsByEvent,
    getInvitationsByEmail,
    deleteInvitation,
    addOrUpdateRSVP,
    getRSVPByInvitation,
    getRSVPsByEvent,
    getEventById,
    getUsers,
    getStudents
} = require('../dynamo');

const Invitation = require('../models/invitation');
const RSVP = require('../models/rsvp');
const emailServer = require('./email-server');
const { v4: uuidv4 } = require('uuid');

class InviteService {
    
    // Create and send invitations for an event
    async createInvitations(eventId, createdAt, inviteeList, organizerUser) {
        try {
            // Get event details
            const eventResult = await getEventById(eventId, createdAt);
            
            if (!eventResult.Item) {
                return {
                    success: false,
                    error: 'Event not found'
                };
            }

            const event = eventResult.Item;

            // Check if user can send invitations for this event
            if (event.organizer_id !== organizerUser.id && organizerUser.auth !== 'admin') {
                return {
                    success: false,
                    error: 'Unauthorized to send invitations for this event'
                };
            }

            // Process invitee list (can be emails or student IDs)
            const processedInvitees = await this.processInviteeList(inviteeList);
            
            if (processedInvitees.length === 0) {
                return {
                    success: false,
                    error: 'No valid invitees provided'
                };
            }

            // Check for duplicate invitations
            const existingInvitations = await getInvitationsByEvent(eventId);
            const alreadyInvited = new Set(
                (existingInvitations.Items || []).map(inv => inv.invitee_email)
            );

            // Filter out already invited users
            const newInvitees = processedInvitees.filter(
                invitee => !alreadyInvited.has(invitee.email)
            );

            if (newInvitees.length === 0) {
                return {
                    success: false,
                    error: 'All specified users have already been invited'
                };
            }

            // Create invitation objects
            const invitations = newInvitees.map(invitee => {
                const invitation = new Invitation({
                    event_id: String(eventId), // Convert numeric eventId to string for DynamoDB
                    invitee_email: invitee.email,
                    invitee_name: invitee.name || '',
                    sent_at: new Date().toISOString(),
                    status: 'sent'
                });

                // Validate and sanitize
                const errors = invitation.validate();
                if (errors.length > 0) {
                    console.error(`Invalid invitation for ${invitee.email}:`, errors);
                    return null;
                }

                invitation.sanitize();
                
                // Debug: Log the invitation object before saving
                console.log('Invitation object to be saved:', {
                    id: invitation.id,
                    event_id: invitation.event_id,
                    invitee_email: invitation.invitee_email,
                    types: {
                        id: typeof invitation.id,
                        event_id: typeof invitation.event_id
                    }
                });
                
                return invitation;
            }).filter(inv => inv !== null);

            // Save invitations to database
            const savePromises = invitations.map(invitation => 
                addOrUpdateInvitation(invitation)
            );

            await Promise.all(savePromises);

            // Send email invitations
            const emailResults = await emailServer.sendBulkInvitations(event, invitations);

            // Update invitation status based on email results
            if (emailResults.success && emailResults.results) {
                for (const result of emailResults.results) {
                    if (result.result.success) {
                        result.invitation.markAsDelivered();
                    } else {
                        result.invitation.markAsFailed(result.result.error || 'Email delivery failed');
                    }
                    
                    // Update invitation status in database
                    await addOrUpdateInvitation(result.invitation);
                }
            }

            console.log(`Sent ${invitations.length} invitations for event: ${event.title}`);

            return {
                success: true,
                invitationsSent: invitations.length,
                emailsSent: emailResults.totalSent || 0,
                emailsFailed: emailResults.totalFailed || 0,
                alreadyInvited: processedInvitees.length - newInvitees.length,
                invitations: invitations
            };

        } catch (error) {
            console.error('Error creating invitations:', error);
            return {
                success: false,
                error: 'Failed to create invitations',
                details: error.message
            };
        }
    }

    // Process invitee list (emails, student IDs, or mixed)
    async processInviteeList(inviteeList) {
        const processedInvitees = [];
        
        try {
            // Get users and students for lookup
            const [users, students] = await Promise.all([
                getUsers(),
                getStudents()
            ]);

            const userMap = new Map((users.Items || []).map(user => [user.email, user]));
            const studentMap = new Map((students.Items || []).map(student => [student.id, student]));

            for (const invitee of inviteeList) {
                if (typeof invitee === 'string') {
                    // Check if it's an email
                    if (invitee.includes('@')) {
                        const user = userMap.get(invitee);
                        processedInvitees.push({
                            email: invitee,
                            name: user ? user.username : ''
                        });
                    } else {
                        // Assume it's a student ID
                        const student = studentMap.get(invitee);
                        if (student && student.email) {
                            processedInvitees.push({
                                email: student.email,
                                name: student.name || student.username || ''
                            });
                        }
                    }
                } else if (invitee && typeof invitee === 'object') {
                    // Object with email and possibly name
                    if (invitee.email) {
                        processedInvitees.push({
                            email: invitee.email,
                            name: invitee.name || ''
                        });
                    }
                }
            }

        } catch (error) {
            console.error('Error processing invitee list:', error);
        }

        // Remove duplicates and invalid emails
        const uniqueInvitees = [];
        const seenEmails = new Set();
        
        for (const invitee of processedInvitees) {
            if (this.isValidEmailAddress(invitee.email) && !seenEmails.has(invitee.email)) {
                seenEmails.add(invitee.email);
                uniqueInvitees.push(invitee);
            }
        }

        return uniqueInvitees;
    }

    // Process RSVP response
    async processRSVP(invitationId, eventId, response, notes = '', responderInfo = {}) {
        try {
            // Validate response
            const validResponses = ['accept', 'maybe', 'decline'];
            if (!validResponses.includes(response)) {
                return {
                    success: false,
                    error: 'Invalid response. Must be accept, maybe, or decline'
                };
            }

            // Get invitation details
            const invitations = await getInvitationsByEvent(eventId);
            const invitation = (invitations.Items || []).find(inv => inv.id === invitationId);
            
            if (!invitation) {
                return {
                    success: false,
                    error: 'Invitation not found'
                };
            }

            // Check if RSVP already exists
            let existingRSVP = null;
            try {
                const rsvpResult = await getRSVPByInvitation(invitationId, eventId);
                existingRSVP = rsvpResult.Item;
            } catch (error) {
                // RSVP doesn't exist yet, which is fine
            }

            // Create or update RSVP
            const rsvpData = {
                invitation_id: invitationId,
                event_id: String(eventId), // Convert numeric eventId to string for DynamoDB
                response: response,
                response_at: new Date().toISOString(),
                notes: notes,
                responder_name: responderInfo.name || invitation.invitee_name || '',
                responder_email: invitation.invitee_email
            };

            const rsvp = new RSVP(rsvpData);
            
            // Validate RSVP
            const validationErrors = rsvp.validate();
            if (validationErrors.length > 0) {
                return {
                    success: false,
                    errors: validationErrors
                };
            }

            // Sanitize input
            rsvp.sanitize();

            // Save RSVP
            await addOrUpdateRSVP(rsvp);

            // Get event details for notification
            const eventResult = await getEventById(eventId, invitation.event_id);
            const event = eventResult.Item;

            // Send notification to organizer if enabled
            if (event) {
                await this.sendRSVPNotificationToOrganizer(event, invitation, rsvp, existingRSVP);
            }

            console.log(`RSVP ${existingRSVP ? 'updated' : 'created'}: ${invitation.invitee_email} -> ${response} for ${event?.title}`);

            return {
                success: true,
                rsvp: rsvp,
                updated: !!existingRSVP,
                message: `RSVP ${existingRSVP ? 'updated' : 'recorded'} successfully`
            };

        } catch (error) {
            console.error('Error processing RSVP:', error);
            return {
                success: false,
                error: 'Failed to process RSVP',
                details: error.message
            };
        }
    }

    // Get invitations for a user
    async getUserInvitations(userEmail, includeResponded = true) {
        try {
            const invitations = await getInvitationsByEmail(userEmail);
            let userInvitations = invitations.Items || [];

            // Get RSVP status for each invitation
            const invitationsWithRSVP = await Promise.all(
                userInvitations.map(async (invitation) => {
                    try {
                        const rsvpResult = await getRSVPByInvitation(invitation.id, invitation.event_id);
                        return {
                            ...invitation,
                            rsvp: rsvpResult.Item || null
                        };
                    } catch (error) {
                        return {
                            ...invitation,
                            rsvp: null
                        };
                    }
                })
            );

            // Filter based on includeResponded preference
            if (!includeResponded) {
                userInvitations = invitationsWithRSVP.filter(inv => !inv.rsvp);
            } else {
                userInvitations = invitationsWithRSVP;
            }

            // Sort by sent date (newest first)
            userInvitations.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));

            return {
                success: true,
                invitations: userInvitations
            };

        } catch (error) {
            console.error('Error getting user invitations:', error);
            return {
                success: false,
                error: 'Failed to get user invitations',
                details: error.message
            };
        }
    }

    // Get RSVP summary for an event
    async getEventRSVPSummary(eventId) {
        try {
            const rsvps = await getRSVPsByEvent(eventId);
            const invitations = await getInvitationsByEvent(eventId);

            const summary = {
                total_invited: (invitations.Items || []).length,
                total_responded: (rsvps.Items || []).length,
                accept: 0,
                maybe: 0,
                decline: 0,
                no_response: 0,
                response_rate: 0
            };

            // Count responses
            (rsvps.Items || []).forEach(rsvp => {
                switch (rsvp.response) {
                    case 'accept':
                        summary.accept++;
                        break;
                    case 'maybe':
                        summary.maybe++;
                        break;
                    case 'decline':
                        summary.decline++;
                        break;
                }
            });

            summary.no_response = summary.total_invited - summary.total_responded;
            summary.response_rate = summary.total_invited > 0 
                ? Math.round((summary.total_responded / summary.total_invited) * 100) 
                : 0;

            return {
                success: true,
                summary: summary,
                rsvps: rsvps.Items || []
            };

        } catch (error) {
            console.error('Error getting RSVP summary:', error);
            return {
                success: false,
                error: 'Failed to get RSVP summary',
                details: error.message
            };
        }
    }

    // Send RSVP notification to event organizer
    async sendRSVPNotificationToOrganizer(event, invitation, rsvp, previousRSVP) {
        try {
            // Check if organizer wants RSVP notifications
            const users = await getUsers();
            const organizer = (users.Items || []).find(user => user.id === event.organizer_id);
            
            if (!organizer || !organizer.rsvp_notifications) {
                return; // Organizer doesn't want notifications
            }

            const action = previousRSVP ? 'updated their RSVP' : 'responded to your invitation';
            const subject = `RSVP ${previousRSVP ? 'Updated' : 'Received'}: ${event.title}`;
            
            const emailContent = `
                <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
                        <h2 style="color: #0C1E3D;">RSVP ${previousRSVP ? 'Updated' : 'Received'}</h2>
                        <p><strong>${invitation.invitee_name || invitation.invitee_email}</strong> has ${action} for:</p>
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">${event.title}</h3>
                            <p><strong>Response:</strong> <span style="color: ${this.getRSVPColor(rsvp.response)}; font-weight: bold;">${rsvp.getResponseLabel()}</span></p>
                            ${rsvp.notes ? `<p><strong>Notes:</strong> ${rsvp.notes}</p>` : ''}
                        </div>
                        <p><a href="${emailServer.getConfiguration().base_url}/events/${event.id}">View Event Details</a></p>
                    </div>
                </div>
            `;

            // Send notification email
            await emailServer.transporter.sendMail({
                from: `"${emailServer.getConfiguration().from_name}" <${emailServer.getConfiguration().from_email}>`,
                to: organizer.email,
                subject: subject,
                html: emailContent
            });

            console.log(`RSVP notification sent to organizer: ${organizer.email}`);

        } catch (error) {
            console.error('Error sending RSVP notification to organizer:', error);
        }
    }

    // Get color for RSVP response
    getRSVPColor(response) {
        switch (response) {
            case 'accept':
                return '#28a745';
            case 'maybe':
                return '#ffc107';
            case 'decline':
                return '#dc3545';
            default:
                return '#6c757d';
        }
    }

    // Remove invitation (cancel invite)
    async removeInvitation(invitationId, eventId, userAuth) {
        try {
            // Get event to check permissions
            const eventResult = await getEventById(eventId, ''); // We'll need to handle this differently
            
            if (!eventResult.Item) {
                return {
                    success: false,
                    error: 'Event not found'
                };
            }

            const event = eventResult.Item;
            
            // Check authorization
            if (event.organizer_id !== userAuth.id && userAuth.auth !== 'admin') {
                return {
                    success: false,
                    error: 'Unauthorized to remove invitations for this event'
                };
            }

            // Delete associated RSVP if it exists
            try {
                await deleteRSVP(invitationId, eventId);
            } catch (error) {
                // RSVP might not exist, that's okay
            }

            // Delete invitation
            await deleteInvitation(invitationId, eventId);

            return {
                success: true,
                message: 'Invitation removed successfully'
            };

        } catch (error) {
            console.error('Error removing invitation:', error);
            return {
                success: false,
                error: 'Failed to remove invitation',
                details: error.message
            };
        }
    }

    // Validate email address
    isValidEmailAddress(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Get pending invitations count for user
    async getPendingInvitationsCount(userEmail) {
        try {
            const result = await this.getUserInvitations(userEmail, false);
            return {
                success: true,
                count: result.success ? result.invitations.length : 0
            };
        } catch (error) {
            return { success: false, count: 0 };
        }
    }
}

module.exports = new InviteService();