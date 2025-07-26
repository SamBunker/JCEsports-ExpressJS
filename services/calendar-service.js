const { 
    addOrUpdateEvent, 
    getEventById, 
    getEventByIdOnly,
    getEvents, 
    deleteEventById, 
    getEventsByOrganizer,
    getInvitationsByEvent,
    getRSVPsByEvent,
    deleteInvitation,
    deleteRSVP
} = require('../dynamo');

const Event = require('../models/event');
const emailServer = require('./email-server');
const { v4: uuidv4 } = require('uuid');

class CalendarService {
    
    // Create a new event with validation
    async createEvent(eventData, organizerUser) {
        try {
            // Create event instance with organizer info
            const eventObj = {
                ...eventData,
                organizer_id: organizerUser.id,
                organizer_email: organizerUser.email,
                created_at: new Date().toISOString()
            };

            const event = new Event(eventObj);
            
            // Validate event data
            const validationErrors = event.validate();
            if (validationErrors.length > 0) {
                return {
                    success: false,
                    errors: validationErrors
                };
            }

            // Sanitize input
            event.sanitize();

            // Save to database
            await addOrUpdateEvent(event);

            console.log(`Event created: ${event.title} by ${organizerUser.email}`);
            
            return {
                success: true,
                event: event,
                id: event.id
            };

        } catch (error) {
            console.error('Error creating event:', error);
            return {
                success: false,
                error: 'Failed to create event',
                details: error.message
            };
        }
    }

    // Get event by ID with additional details
    async getEventDetails(eventId, createdAt) {
        try {
            let eventResult;
            
            // If no created_at provided, search by ID only
            if (!createdAt || createdAt === '') {
                eventResult = await getEventByIdOnly(eventId);
            } else {
                eventResult = await getEventById(eventId, createdAt);
            }
            
            if (!eventResult.Item) {
                return {
                    success: false,
                    error: 'Event not found'
                };
            }

            const event = eventResult.Item;
            
            // Get invitations and RSVPs
            const [invitations, rsvps] = await Promise.all([
                getInvitationsByEvent(eventId),
                getRSVPsByEvent(eventId)
            ]);

            // Calculate RSVP summary
            const rsvpSummary = this.calculateRSVPSummary(rsvps.Items || []);
            
            return {
                success: true,
                event: event,
                invitations: invitations.Items || [],
                rsvps: rsvps.Items || [],
                rsvpSummary: rsvpSummary,
                totalInvited: invitations.Items?.length || 0
            };

        } catch (error) {
            console.error('Error getting event details:', error);
            return {
                success: false,
                error: 'Failed to get event details',
                details: error.message
            };
        }
    }

    // Update an existing event
    async updateEvent(eventId, createdAt, updateData, userAuth) {
        try {
            // Get existing event
            const existingResult = await getEventById(eventId, createdAt);
            
            if (!existingResult.Item) {
                return {
                    success: false,
                    error: 'Event not found'
                };
            }

            const existingEvent = existingResult.Item;

            // Check authorization (only organizer or admin can update)
            if (existingEvent.organizer_id !== userAuth.id && userAuth.auth !== 'admin') {
                return {
                    success: false,
                    error: 'Unauthorized to update this event'
                };
            }

            // Create updated event object
            const updatedEventData = {
                ...existingEvent,
                ...updateData,
                updated_at: new Date().toISOString()
            };

            const updatedEvent = new Event(updatedEventData);
            
            // Validate updated data
            const validationErrors = updatedEvent.validate();
            if (validationErrors.length > 0) {
                return {
                    success: false,
                    errors: validationErrors
                };
            }

            // Sanitize input
            updatedEvent.sanitize();

            // Save updated event
            await addOrUpdateEvent(updatedEvent);

            // Identify what changed for notifications
            const changes = this.identifyChanges(existingEvent, updatedEvent);
            
            // Send update notifications if there are significant changes
            if (changes.length > 0) {
                await this.sendUpdateNotifications(updatedEvent, changes);
            }

            console.log(`Event updated: ${updatedEvent.title} by ${userAuth.email}`);
            
            return {
                success: true,
                event: updatedEvent,
                changes: changes
            };

        } catch (error) {
            console.error('Error updating event:', error);
            return {
                success: false,
                error: 'Failed to update event',
                details: error.message
            };
        }
    }

    // Delete an event with cascade to invitations and RSVPs
    async deleteEvent(eventId, createdAt, userAuth) {
        try {
            // Get existing event
            const existingResult = await getEventById(eventId, createdAt);
            
            if (!existingResult.Item) {
                return {
                    success: false,
                    error: 'Event not found'
                };
            }

            const existingEvent = existingResult.Item;

            // Check authorization (only organizer or admin can delete)
            if (existingEvent.organizer_id !== userAuth.id && userAuth.auth !== 'admin') {
                return {
                    success: false,
                    error: 'Unauthorized to delete this event'
                };
            }

            // Get all invitations and RSVPs to delete
            const [invitations, rsvps] = await Promise.all([
                getInvitationsByEvent(eventId),
                getRSVPsByEvent(eventId)
            ]);

            // Delete all RSVPs first
            const rsvpDeletePromises = (rsvps.Items || []).map(rsvp => 
                deleteRSVP(rsvp.invitation_id, rsvp.event_id)
            );

            // Delete all invitations
            const invitationDeletePromises = (invitations.Items || []).map(invitation => 
                deleteInvitation(invitation.id, invitation.event_id)
            );

            // Delete event
            const eventDeletePromise = deleteEventById(eventId, createdAt);

            // Execute all deletions
            await Promise.all([
                ...rsvpDeletePromises,
                ...invitationDeletePromises,
                eventDeletePromise
            ]);

            console.log(`Event deleted: ${existingEvent.title} by ${userAuth.email}`);
            
            return {
                success: true,
                message: `Event "${existingEvent.title}" and all related data deleted successfully`,
                deletedInvitations: invitations.Items?.length || 0,
                deletedRSVPs: rsvps.Items?.length || 0
            };

        } catch (error) {
            console.error('Error deleting event:', error);
            return {
                success: false,
                error: 'Failed to delete event',
                details: error.message
            };
        }
    }

    // Get events by organizer
    async getEventsByUser(userId) {
        try {
            const result = await getEventsByOrganizer(userId);
            
            return {
                success: true,
                events: result.Items || []
            };

        } catch (error) {
            console.error('Error getting events by user:', error);
            return {
                success: false,
                error: 'Failed to get user events',
                details: error.message
            };
        }
    }

    // Get all events (for admin or public calendar)
    async getAllEvents(includePrivate = false) {
        try {
            const result = await getEvents();
            let events = result || [];

            // Filter private events if not admin view
            if (!includePrivate) {
                events = events.filter(event => event.is_public);
            }

            // Sort by start date
            events.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

            return {
                success: true,
                events: events
            };

        } catch (error) {
            console.error('Error getting all events:', error);
            
            // If table doesn't exist, return empty array gracefully
            if (error.code === 'ResourceNotFoundException') {
                console.log('Events table not found - returning empty events array');
                return {
                    success: true,
                    events: []
                };
            }
            
            return {
                success: false,
                error: 'Failed to get events',
                details: error.message
            };
        }
    }

    // Get events formatted for FullCalendar
    async getEventsForCalendar(userId = null, includePrivate = false) {
        try {
            const result = await this.getAllEvents(includePrivate);
            
            if (!result.success) {
                return result;
            }

            // If we have events from new system, convert to FullCalendar format
            if (result.events && result.events.length > 0) {
                const calendarEvents = result.events.map(event => {
                    const eventInstance = new Event(event);
                    return eventInstance.toFullCalendarFormat();
                });

                return {
                    success: true,
                    events: calendarEvents
                };
            }

            // If no events from new system, indicate we should fall back
            return {
                success: true,
                events: [],
                shouldFallback: true
            };

        } catch (error) {
            console.error('Error getting calendar events:', error);
            return {
                success: false,
                error: 'Failed to get calendar events',
                details: error.message,
                shouldFallback: true
            };
        }
    }

    // Calculate RSVP summary from RSVPs
    calculateRSVPSummary(rsvps) {
        const summary = {
            total: rsvps.length,
            accept: 0,
            maybe: 0,
            decline: 0,
            no_response: 0
        };

        rsvps.forEach(rsvp => {
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
                default:
                    summary.no_response++;
            }
        });

        return summary;
    }

    // Identify changes between old and new event
    identifyChanges(oldEvent, newEvent) {
        const changes = [];
        
        if (oldEvent.title !== newEvent.title) {
            changes.push(`Title changed from "${oldEvent.title}" to "${newEvent.title}"`);
        }
        
        if (oldEvent.start_date !== newEvent.start_date) {
            changes.push(`Start time changed from ${new Date(oldEvent.start_date).toLocaleString()} to ${new Date(newEvent.start_date).toLocaleString()}`);
        }
        
        if (oldEvent.end_date !== newEvent.end_date) {
            changes.push(`End time changed from ${new Date(oldEvent.end_date).toLocaleString()} to ${new Date(newEvent.end_date).toLocaleString()}`);
        }
        
        if (oldEvent.location !== newEvent.location) {
            changes.push(`Location changed from "${oldEvent.location || 'TBD'}" to "${newEvent.location || 'TBD'}"`);
        }
        
        if (oldEvent.description !== newEvent.description) {
            changes.push('Event description updated');
        }

        return changes;
    }

    // Send update notifications to all invitees
    async sendUpdateNotifications(event, changes) {
        try {
            // Get all invitations for this event
            const invitations = await getInvitationsByEvent(event.id);
            
            if (!invitations.Items || invitations.Items.length === 0) {
                return;
            }

            // Extract email addresses
            const recipientEmails = invitations.Items.map(invitation => invitation.invitee_email);
            
            // Send update notifications
            await emailServer.sendEventUpdateNotification(event, changes, recipientEmails);
            
            console.log(`Update notifications sent for event: ${event.title}`);

        } catch (error) {
            console.error('Error sending update notifications:', error);
        }
    }

    // Validate event permissions
    canUserManageEvent(event, user) {
        return event.organizer_id === user.id || user.auth === 'admin';
    }

    // Check if user can view event
    canUserViewEvent(event, user) {
        if (event.is_public) {
            return true;
        }
        
        return this.canUserManageEvent(event, user);
    }

    // Get upcoming events
    async getUpcomingEvents(limit = 10) {
        try {
            const result = await this.getAllEvents(false);
            
            if (!result.success) {
                return result;
            }

            // Filter upcoming events and limit results
            const now = new Date();
            const upcomingEvents = result.events
                .filter(event => new Date(event.start_date) > now)
                .slice(0, limit);

            return {
                success: true,
                events: upcomingEvents
            };

        } catch (error) {
            console.error('Error getting upcoming events:', error);
            return {
                success: false,
                error: 'Failed to get upcoming events',
                details: error.message
            };
        }
    }
}

module.exports = new CalendarService();