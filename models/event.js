function Event(eventObj) {
    // Generate numeric ID if not provided (for DynamoDB Number type)
    this.id = eventObj.id || Math.floor(Math.random() * 1000000000) + Date.now();
    this.created_at = eventObj.created_at || new Date().toISOString();
    this.title = eventObj.title;
    this.description = eventObj.description || '';
    this.start_date = eventObj.start_date;
    this.end_date = eventObj.end_date;
    this.location = eventObj.location || '';
    this.organizer_id = eventObj.organizer_id;
    this.organizer_email = eventObj.organizer_email;
    this.is_public = eventObj.is_public !== undefined ? eventObj.is_public : true;
    this.max_attendees = eventObj.max_attendees || null;
    this.updated_at = new Date().toISOString();
}

// Validation methods
Event.prototype.validate = function() {
    const errors = [];
    
    if (!this.title || this.title.trim().length === 0) {
        errors.push('Title is required');
    }
    
    if (!this.start_date) {
        errors.push('Start date is required');
    } else if (!this.isValidDate(this.start_date)) {
        errors.push('Invalid start date format. Use ISO 8601 format');
    }
    
    if (!this.end_date) {
        errors.push('End date is required');
    } else if (!this.isValidDate(this.end_date)) {
        errors.push('Invalid end date format. Use ISO 8601 format');
    }
    
    if (this.start_date && this.end_date && new Date(this.start_date) >= new Date(this.end_date)) {
        errors.push('End date must be after start date');
    }
    
    if (!this.organizer_id) {
        errors.push('Organizer ID is required');
    }
    
    if (!this.organizer_email || !this.isValidEmail(this.organizer_email)) {
        errors.push('Valid organizer email is required');
    }
    
    if (this.max_attendees && (this.max_attendees < 1 || !Number.isInteger(this.max_attendees))) {
        errors.push('Max attendees must be a positive integer');
    }
    
    return errors;
};

Event.prototype.isValidDate = function(dateString) {
    // Check ISO 8601 format and valid date
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date) && dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
};

Event.prototype.isValidEmail = function(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Helper methods for date formatting
Event.prototype.getFormattedStartDate = function() {
    return new Date(this.start_date).toLocaleString();
};

Event.prototype.getFormattedEndDate = function() {
    return new Date(this.end_date).toLocaleString();
};

Event.prototype.getDuration = function() {
    const start = new Date(this.start_date);
    const end = new Date(this.end_date);
    const durationMs = end - start;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
};

Event.prototype.isUpcoming = function() {
    return new Date(this.start_date) > new Date();
};

Event.prototype.isPast = function() {
    return new Date(this.end_date) < new Date();
};

Event.prototype.isActive = function() {
    const now = new Date();
    return new Date(this.start_date) <= now && new Date(this.end_date) > now;
};

// Convert to format suitable for FullCalendar
Event.prototype.toFullCalendarFormat = function() {
    return {
        id: this.id,
        title: this.title,
        start: this.start_date,
        end: this.end_date,
        description: this.description,
        location: this.location,
        extendedProps: {
            organizer_id: this.organizer_id,
            organizer_email: this.organizer_email,
            is_public: this.is_public,
            max_attendees: this.max_attendees,
            created_at: this.created_at
        }
    };
};

// Sanitize input using existing pattern
Event.prototype.sanitizeInput = function(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/[^a-zA-Z0-9\-\_\.\@\s]/g, '');
};

// Apply sanitization to string fields
Event.prototype.sanitize = function() {
    this.title = this.sanitizeInput(this.title);
    this.description = this.sanitizeInput(this.description);
    this.location = this.sanitizeInput(this.location);
    return this;
};

module.exports = Event;