const nodemailer = require('nodemailer');
const ical = require('ical-generator');
const { getUsers } = require('../dynamo');

// Email server configuration
class EmailServer {
    constructor() {
        this.transporter = null;
        this.config = {
            // SMTP Configuration
            smtp_host: process.env.SMTP_HOST || 'smtp.gmail.com',
            smtp_port: process.env.SMTP_PORT || 587,
            smtp_secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            smtp_user: process.env.SMTP_USER || '',
            smtp_password: process.env.SMTP_PASSWORD || '',
            
            // Site Configuration
            from_email: process.env.FROM_EMAIL || 'noreply@jcesports.edu',
            from_name: process.env.FROM_NAME || 'Juniata College Esports',
            base_url: process.env.BASE_URL || 'http://localhost:3000',
            organization_name: 'Juniata College Esports',
            support_email: process.env.SUPPORT_EMAIL || 'support@jcesports.edu',
            
            // Email Settings
            enable_email: process.env.ENABLE_EMAIL !== 'false',
            max_recipients: parseInt(process.env.MAX_RECIPIENTS) || 50,
            rate_limit: parseInt(process.env.EMAIL_RATE_LIMIT) || 10 // emails per minute
        };

        this.initializeTransporter();
    }

    // Initialize email transporter
    initializeTransporter() {
        if (!this.config.enable_email) {
            console.log('Email sending is disabled');
            return;
        }

        try {
            this.transporter = nodemailer.createTransport({
                host: this.config.smtp_host,
                port: this.config.smtp_port,
                secure: this.config.smtp_secure,
                auth: {
                    user: this.config.smtp_user,
                    pass: this.config.smtp_password
                },
                // Connection pool settings
                pool: true,
                maxConnections: 5,
                maxMessages: 100,
                rateDelta: 60000, // 1 minute
                rateLimit: this.config.rate_limit
            });

            // Verify connection
            this.transporter.verify((error, success) => {
                if (error) {
                    console.error('Email server connection failed:', error);
                } else {
                    console.log('Email server is ready to send emails');
                }
            });

        } catch (error) {
            console.error('Failed to initialize email transporter:', error);
        }
    }

    // Get user email preferences
    async getUserPreferences(email) {
        try {
            const users = await getUsers();
            const user = users.Items?.find(u => u.email === email);
            return user ? {
                email_notifications: user.email_notifications !== false,
                calendar_invites: user.calendar_invites !== false,
                event_reminders: user.event_reminders !== false,
                rsvp_notifications: user.rsvp_notifications === true
            } : {
                // Default preferences for non-registered users (students)
                email_notifications: true,
                calendar_invites: true,
                event_reminders: false,
                rsvp_notifications: false
            };
        } catch (error) {
            console.error('Error getting user preferences:', error);
            return {
                email_notifications: true,
                calendar_invites: true,
                event_reminders: false,
                rsvp_notifications: false
            };
        }
    }

    // Generate .ics calendar file for event
    generateCalendarInvite(event, invitation) {
        const calendar = ical({
            name: `${this.config.organization_name} Calendar`,
            method: 'REQUEST',
            prodId: {
                company: this.config.organization_name,
                product: 'Calendar Invite System'
            }
        });

        calendar.createEvent({
            start: new Date(event.start_date),
            end: new Date(event.end_date),
            summary: event.title,
            description: `${event.description}\n\nRSVP: ${this.config.base_url}/rsvp/${invitation.id}/${event.id}`,
            location: event.location || '',
            url: `${this.config.base_url}/events/${event.id}`,
            organizer: {
                name: this.config.organization_name,
                email: event.organizer_email
            },
            attendees: [{
                name: invitation.invitee_name || invitation.invitee_email,
                email: invitation.invitee_email,
                rsvp: true,
                status: 'NEEDS-ACTION'
            }],
            status: 'CONFIRMED',
            busystatus: 'BUSY'
        });

        return calendar.toString();
    }

    // Send calendar invite email
    async sendCalendarInvite(event, invitation) {
        if (!this.config.enable_email || !this.transporter) {
            console.log('Email service not available');
            return { success: false, message: 'Email service not available' };
        }

        const userPrefs = await this.getUserPreferences(invitation.invitee_email);
        
        if (!userPrefs.email_notifications || !userPrefs.calendar_invites) {
            console.log(`User ${invitation.invitee_email} has disabled calendar invites`);
            return { success: false, message: 'User has disabled calendar invites' };
        }

        try {
            const icsContent = this.generateCalendarInvite(event, invitation);
            const rsvpLink = `${this.config.base_url}/rsvp/${invitation.id}/${event.id}`;

            const mailOptions = {
                from: `"${this.config.from_name}" <${this.config.from_email}>`,
                to: invitation.invitee_email,
                subject: `📅 Calendar Invite: ${event.title}`,
                html: this.generateInviteEmailHtml(event, invitation, rsvpLink),
                text: this.generateInviteEmailText(event, invitation, rsvpLink),
                attachments: [{
                    filename: `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`,
                    content: icsContent,
                    contentType: 'text/calendar; method=REQUEST'
                }],
                headers: {
                    'X-Priority': '3',
                    'X-MSMail-Priority': 'Normal',
                    'Importance': 'Normal'
                }
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`Calendar invite sent to ${invitation.invitee_email}:`, result.messageId);
            
            return { 
                success: true, 
                messageId: result.messageId,
                response: result.response 
            };

        } catch (error) {
            console.error('Error sending calendar invite:', error);
            return { success: false, error: error.message };
        }
    }

    // Generate HTML email content for invitation
    generateInviteEmailHtml(event, invitation, rsvpLink) {
        const eventStart = new Date(event.start_date).toLocaleString();
        const eventEnd = new Date(event.end_date).toLocaleString();
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Calendar Invite</title>
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <div style="background-color: #0C1E3D; color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">${this.config.organization_name}</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">You're Invited!</p>
                </div>
                
                <!-- Event Details -->
                <div style="padding: 30px;">
                    <h2 style="color: #333; margin-top: 0; font-size: 22px;">${event.title}</h2>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0C1E3D;">
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #0C1E3D;">📅 When:</strong><br>
                            <span style="font-size: 16px;">${eventStart}</span><br>
                            <span style="color: #666; font-size: 14px;">to ${eventEnd}</span>
                        </div>
                        
                        ${event.location ? `
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #0C1E3D;">📍 Where:</strong><br>
                            <span style="font-size: 16px;">${event.location}</span>
                        </div>
                        ` : ''}
                        
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #0C1E3D;">👤 Organizer:</strong><br>
                            <span style="font-size: 16px;">${event.organizer_email}</span>
                        </div>
                        
                        ${event.description ? `
                        <div>
                            <strong style="color: #0C1E3D;">📝 Description:</strong><br>
                            <span style="font-size: 16px; line-height: 1.5;">${event.description}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- RSVP Buttons -->
                    <div style="text-align: center; margin: 40px 0;">
                        <h3 style="color: #333; margin-bottom: 20px;">Will you attend?</h3>
                        <div style="margin: 20px 0;">
                            <a href="${rsvpLink}?response=accept" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; margin: 8px; display: inline-block; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">✅ Yes, I'll be there</a>
                        </div>
                        <div style="margin: 20px 0;">
                            <a href="${rsvpLink}?response=maybe" style="background-color: #ffc107; color: #333; padding: 12px 25px; text-decoration: none; border-radius: 25px; margin: 8px; display: inline-block; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">❓ Maybe</a>
                        </div>
                        <div style="margin: 20px 0;">
                            <a href="${rsvpLink}?response=decline" style="background-color: #dc3545; color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; margin: 8px; display: inline-block; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">❌ Can't make it</a>
                        </div>
                    </div>
                    
                    <!-- Additional Links -->
                    <div style="text-align: center; padding: 20px 0; border-top: 1px solid #eee;">
                        <p style="margin: 0;">
                            <a href="${this.config.base_url}/events/${event.id}" style="color: #0C1E3D; text-decoration: none; font-weight: bold;">📋 View Full Event Details</a>
                        </p>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                    <p style="margin: 0; font-size: 12px; color: #666;">
                        This invitation was sent by ${this.config.organization_name}<br>
                        Questions? Contact us at <a href="mailto:${this.config.support_email}" style="color: #0C1E3D;">${this.config.support_email}</a>
                    </p>
                    <p style="margin: 10px 0 0 0; font-size: 11px; color: #999;">
                        The calendar file (.ics) is attached to this email for easy import into your calendar app.
                    </p>
                </div>
            </div>
        </body>
        </html>`;
    }

    // Generate plain text email content
    generateInviteEmailText(event, invitation, rsvpLink) {
        return `
${this.config.organization_name}
========================================

YOU'RE INVITED: ${event.title}

Event Details:
📅 When: ${new Date(event.start_date).toLocaleString()} - ${new Date(event.end_date).toLocaleString()}
${event.location ? `📍 Where: ${event.location}` : ''}
👤 Organizer: ${event.organizer_email}
${event.description ? `📝 Description: ${event.description}` : ''}

RSVP Options:
✅ Accept: ${rsvpLink}?response=accept
❓ Maybe: ${rsvpLink}?response=maybe  
❌ Decline: ${rsvpLink}?response=decline

View Event Details: ${this.config.base_url}/events/${event.id}

Questions? Contact us at ${this.config.support_email}

Note: A calendar file (.ics) is attached to easily add this event to your calendar.
        `;
    }

    // Send bulk invitations with rate limiting
    async sendBulkInvitations(event, invitations) {
        if (!this.config.enable_email || !this.transporter) {
            return { success: false, message: 'Email service not available' };
        }

        const results = [];
        const batchSize = Math.min(this.config.max_recipients, 10); // Send in batches
        
        for (let i = 0; i < invitations.length; i += batchSize) {
            const batch = invitations.slice(i, i + batchSize);
            const batchPromises = batch.map(invitation => 
                this.sendCalendarInvite(event, invitation)
                    .then(result => ({ invitation, result }))
                    .catch(error => ({ invitation, result: { success: false, error: error.message } }))
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Wait between batches to respect rate limits
            if (i + batchSize < invitations.length) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
            }
        }

        return {
            success: true,
            totalSent: results.filter(r => r.result.success).length,
            totalFailed: results.filter(r => !r.result.success).length,
            results: results
        };
    }

    // Send event update notification
    async sendEventUpdateNotification(event, updates, recipientEmails) {
        if (!this.config.enable_email || !this.transporter) {
            return { success: false, message: 'Email service not available' };
        }

        const results = [];
        
        for (const email of recipientEmails) {
            const userPrefs = await this.getUserPreferences(email);
            
            if (userPrefs.email_notifications && userPrefs.event_reminders) {
                try {
                    const mailOptions = {
                        from: `"${this.config.from_name}" <${this.config.from_email}>`,
                        to: email,
                        subject: `📝 Event Updated: ${event.title}`,
                        html: this.generateUpdateEmailHtml(event, updates),
                        text: this.generateUpdateEmailText(event, updates)
                    };

                    const result = await this.transporter.sendMail(mailOptions);
                    results.push({ email, success: true, messageId: result.messageId });
                } catch (error) {
                    results.push({ email, success: false, error: error.message });
                }
            } else {
                results.push({ email, success: false, message: 'User notifications disabled' });
            }
        }
        
        return results;
    }

    // Generate update notification HTML
    generateUpdateEmailHtml(event, updates) {
        return `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
                <div style="background-color: #0C1E3D; color: white; padding: 20px; margin: -30px -30px 20px -30px; text-align: center;">
                    <h1 style="margin: 0;">📝 Event Updated</h1>
                </div>
                <h2 style="color: #333;">${event.title}</h2>
                <p>The following changes have been made to this event:</p>
                <ul style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
                    ${updates.map(update => `<li style="margin-bottom: 10px;">${update}</li>`).join('')}
                </ul>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${this.config.base_url}/events/${event.id}" style="background-color: #0C1E3D; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Updated Event</a>
                </div>
            </div>
        </div>`;
    }

    // Generate update notification text
    generateUpdateEmailText(event, updates) {
        return `
Event Updated: ${event.title}

The following changes have been made:
${updates.map(update => `- ${update}`).join('\n')}

View updated event: ${this.config.base_url}/events/${event.id}
        `;
    }

    // Test email configuration
    async testEmailConfiguration() {
        if (!this.transporter) {
            return { success: false, message: 'Email transporter not initialized' };
        }

        try {
            await this.transporter.verify();
            return { success: true, message: 'Email configuration is valid' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get current configuration
    getConfiguration() {
        return { ...this.config, smtp_password: '***' }; // Hide password
    }

    // Update configuration (for admin use)
    updateConfiguration(newConfig) {
        Object.assign(this.config, newConfig);
        this.initializeTransporter();
    }
}

module.exports = new EmailServer();