function Invitation(invitationObj) {
    // Generate numeric ID if not provided (for DynamoDB Number type)
    this.id = invitationObj.id || Math.floor(Math.random() * 1000000000) + Date.now();
    this.event_id = invitationObj.event_id;
    this.invitee_email = invitationObj.invitee_email;
    this.invitee_name = invitationObj.invitee_name || '';
    this.sent_at = invitationObj.sent_at || new Date().toISOString();
    this.status = invitationObj.status || 'sent'; // sent|delivered|failed
}

// Validation methods
Invitation.prototype.validate = function() {
    const errors = [];
    
    if (!this.event_id) {
        errors.push('Event ID is required');
    }
    
    if (!this.invitee_email || !this.isValidEmail(this.invitee_email)) {
        errors.push('Valid invitee email is required');
    }
    
    if (!this.isValidStatus(this.status)) {
        errors.push('Status must be one of: sent, delivered, failed');
    }
    
    return errors;
};

Invitation.prototype.isValidEmail = function(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

Invitation.prototype.isValidStatus = function(status) {
    const validStatuses = ['sent', 'delivered', 'failed'];
    return validStatuses.includes(status);
};

// Status tracking methods
Invitation.prototype.markAsDelivered = function() {
    this.status = 'delivered';
    this.delivered_at = new Date().toISOString();
};

Invitation.prototype.markAsFailed = function(errorMessage) {
    this.status = 'failed';
    this.failed_at = new Date().toISOString();
    this.error_message = errorMessage;
};

Invitation.prototype.isSent = function() {
    return this.status === 'sent';
};

Invitation.prototype.isDelivered = function() {
    return this.status === 'delivered';
};

Invitation.prototype.isFailed = function() {
    return this.status === 'failed';
};

// Sanitize input using existing pattern
Invitation.prototype.sanitizeInput = function(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/[^a-zA-Z0-9\-\_\.\@\s]/g, '');
};

// Apply sanitization to string fields
Invitation.prototype.sanitize = function() {
    this.invitee_name = this.sanitizeInput(this.invitee_name);
    // Don't sanitize email as it needs special characters
    return this;
};

// Helper method to get formatted sent date
Invitation.prototype.getFormattedSentDate = function() {
    return new Date(this.sent_at).toLocaleString();
};

// Generate RSVP link (to be used with base URL from environment)
Invitation.prototype.generateRSVPLink = function(baseUrl) {
    return `${baseUrl}/rsvp/${this.id}/${this.event_id}`;
};

module.exports = Invitation;