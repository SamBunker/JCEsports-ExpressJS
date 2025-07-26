function User(userObj) {
    this.id = userObj.id;
    this.email = userObj.email;
    this.auth = userObj.auth;
    this.username = userObj.username;
    // Email notification preferences
    this.email_notifications = userObj.email_notifications !== undefined ? userObj.email_notifications : true;
    this.calendar_invites = userObj.calendar_invites !== undefined ? userObj.calendar_invites : true;
    this.event_reminders = userObj.event_reminders !== undefined ? userObj.event_reminders : true;
    this.rsvp_notifications = userObj.rsvp_notifications !== undefined ? userObj.rsvp_notifications : false;
}
module.exports = User;