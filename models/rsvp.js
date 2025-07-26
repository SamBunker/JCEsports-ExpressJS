function RSVP(rsvpObj) {
    this.invitation_id = rsvpObj.invitation_id;
    this.event_id = rsvpObj.event_id;
    this.response = rsvpObj.response; // accept|maybe|decline
    this.response_at = rsvpObj.response_at || new Date().toISOString();
    this.notes = rsvpObj.notes || '';
    this.responder_name = rsvpObj.responder_name || '';
    this.responder_email = rsvpObj.responder_email || '';
}

// Validation methods
RSVP.prototype.validate = function() {
    const errors = [];
    
    if (!this.invitation_id) {
        errors.push('Invitation ID is required');
    }
    
    if (!this.event_id) {
        errors.push('Event ID is required');
    }
    
    if (!this.response || !this.isValidResponse(this.response)) {
        errors.push('Response must be one of: accept, maybe, decline');
    }
    
    return errors;
};

RSVP.prototype.isValidResponse = function(response) {
    const validResponses = ['accept', 'maybe', 'decline'];
    return validResponses.includes(response);
};

// Response status methods
RSVP.prototype.isAccepted = function() {
    return this.response === 'accept';
};

RSVP.prototype.isMaybe = function() {
    return this.response === 'maybe';
};

RSVP.prototype.isDeclined = function() {
    return this.response === 'decline';
};

// Sanitize input using existing pattern
RSVP.prototype.sanitizeInput = function(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/[^a-zA-Z0-9\-\_\.\@\s]/g, '');
};

// Apply sanitization to string fields
RSVP.prototype.sanitize = function() {
    this.notes = this.sanitizeInput(this.notes);
    this.responder_name = this.sanitizeInput(this.responder_name);
    // Don't sanitize email as it needs special characters
    return this;
};

// Helper methods
RSVP.prototype.getFormattedResponseDate = function() {
    return new Date(this.response_at).toLocaleString();
};

RSVP.prototype.getResponseLabel = function() {
    switch(this.response) {
        case 'accept':
            return 'Attending';
        case 'maybe':
            return 'Maybe';
        case 'decline':
            return 'Not Attending';
        default:
            return 'Unknown';
    }
};

RSVP.prototype.getResponseIcon = function() {
    switch(this.response) {
        case 'accept':
            return '✅';
        case 'maybe':
            return '❓';
        case 'decline':
            return '❌';
        default:
            return '❓';
    }
};

// Update response
RSVP.prototype.updateResponse = function(newResponse, notes) {
    if (this.isValidResponse(newResponse)) {
        this.response = newResponse;
        this.response_at = new Date().toISOString();
        if (notes) {
            this.notes = this.sanitizeInput(notes);
        }
    }
};

module.exports = RSVP;