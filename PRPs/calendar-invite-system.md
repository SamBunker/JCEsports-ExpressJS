# Enhanced Calendar Invite System PRP

## Goal

Build a comprehensive calendar invite system for the JCEsports website that allows authenticated users to create events, send invitations via email, and manage RSVP responses through an enhanced admin dashboard. The system should integrate with the existing ExpressJS/Handlebars architecture and DynamoDB backend.

## Why

- **Enhanced User Engagement**: Allows teams and community members to create and participate in events
- **Professional Event Management**: Provides calendar invites that integrate with users' personal calendars
- **Administrative Control**: Gives admins oversight of all events and invitation management
- **Community Building**: Facilitates coordination of tournaments, practices, and social events
- **Integration with Existing System**: Leverages current authentication and database infrastructure

## What

A full-featured calendar invitation system that extends the current basic calendar functionality with:

### User-Visible Behavior
- **Public Calendar View**: Enhanced teamschedule page showing all public events
- **Event Creation**: Authenticated users can create events with details, dates, and invite lists
- **Email Invitations**: Automatic .ics calendar invites sent via email
- **RSVP Management**: Users can respond to invitations (Accept/Maybe/Decline)
- **Admin Dashboard**: Enhanced admin panel for event oversight and management
- **User Dashboard**: Personal view of created events and received invitations

### Technical Requirements
- Integration with existing Express.js session-based authentication
- DynamoDB tables for events, invitations, and RSVPs
- AWS SES for email delivery with calendar attachments
- FullCalendar.js enhancements for interactive event management
- Handlebars templates for all UI components

### Success Criteria

- [ ] Users can create events and send invitations that appear in recipients' calendars
- [ ] Email invitations contain proper .ics attachments compatible with major calendar apps
- [ ] RSVP responses are tracked and visible to event organizers
- [ ] Admin dashboard provides complete event and user management
- [ ] All functionality integrates seamlessly with existing authentication system
- [ ] Performance remains acceptable with 100+ concurrent users and 1000+ events

## All Needed Context

### Documentation & References

```yaml
# MUST READ - Include these in your context window
- url: https://fullcalendar.io/docs/event-object
  why: Event object structure and properties for calendar integration

- url: https://fullcalendar.io/docs/events-json-feed  
  why: How to feed events dynamically to FullCalendar from Express endpoints

- url: https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/ses-examples-sending-email.html
  why: AWS SES integration for email invitations with attachments

- url: https://expressjs.com/en/advanced/best-practice-security.html
  why: Security patterns for session-based authentication in Express

- url: https://www.npmjs.com/package/ical-generator
  why: Creating .ics calendar files for email attachments

- file: app.js
  why: Existing authentication middleware patterns and DynamoDB integration

- file: dynamo.js  
  why: Current database patterns and table structures to extend

- file: views/admin.handlebars
  why: Admin UI patterns and form structures to replicate

- file: views/teamschedule.handlebars
  why: Current calendar implementation to enhance

- file: public/js/admin.js
  why: Client-side JavaScript patterns for form management
```

### Current Codebase Structure

```bash
D:\Development Projects\JCEsports-ExpressJS\
├── app.js                 # Main Express application with auth & routes
├── dynamo.js             # DynamoDB operations (students, users, calendar-events)
├── models/
│   └── user.js           # User session model
├── views/
│   ├── layouts/
│   │   └── main.handlebars    # Main layout with navigation
│   ├── admin.handlebars       # Admin dashboard with calendar actions
│   ├── teamschedule.handlebars # Public calendar view
│   └── [other pages]
├── public/
│   ├── js/
│   │   └── admin.js          # Admin form management
│   └── css/
│       └── admin.css         # Admin styling
└── package.json              # Dependencies (aws-sdk, express, handlebars, etc.)
```

### Desired Codebase Structure with New Files

```bash
D:\Development Projects\JCEsports-ExpressJS\
├── app.js                    # Enhanced with invite routes and middleware
├── dynamo.js                # Extended with invite/RSVP table operations
├── models/
│   ├── user.js              # Existing user model
│   ├── event.js             # NEW: Event model with validation
│   ├── invitation.js        # NEW: Invitation model
│   └── rsvp.js              # NEW: RSVP response model
├── services/
│   ├── email-service.js     # NEW: AWS SES integration with .ics generation
│   ├── calendar-service.js  # NEW: Event management business logic
│   └── invite-service.js    # NEW: Invitation and RSVP management
├── views/
│   ├── user-dashboard.handlebars  # NEW: Personal event management
│   ├── create-event.handlebars    # NEW: Event creation form
│   ├── event-details.handlebars   # NEW: Event details and RSVP management
│   └── invite-response.handlebars # NEW: RSVP response page
├── public/
│   ├── js/
│   │   ├── calendar-enhanced.js   # NEW: Enhanced calendar interactions
│   │   ├── event-creation.js      # NEW: Event form management
│   │   └── invite-management.js   # NEW: RSVP handling
│   └── css/
│       ├── calendar.css          # NEW: Calendar-specific styling
│       └── events.css            # NEW: Event management styling
└── PRPs/
    └── calendar-invite-system.md # This PRP document
```

### Known Gotchas & Library Quirks

```javascript
// CRITICAL: DynamoDB requires both partition and sort keys for delete operations
// Current calendar events use id + start as composite key

// CRITICAL: AWS SES requires verified email addresses in development
// Use SES sandbox mode for testing

// CRITICAL: FullCalendar expects specific date format
// Must use ISO 8601 format: "2024-01-15T10:00:00"

// CRITICAL: Express-session requires secure cookies in production
// Current implementation uses random secret - should be environment variable

// CRITICAL: Bcrypt salt rounds hardcoded to 10
// Should be configurable via environment

// CRITICAL: Input sanitization only removes special chars
// Need proper validation for email addresses and dates

// CRITICAL: Current error handling inconsistent
// Some use console.error, others use res.status(500).json()
```

## Implementation Blueprint

### Data Models and Structure

```javascript
// DynamoDB Table Structures
const EVENTS_TABLE = 'jcesports-db-events';
const INVITATIONS_TABLE = 'jcesports-db-invitations';
const RSVPS_TABLE = 'jcesports-db-rsvps';

// Event Model
{
  id: "uuid",           // Partition Key
  created_at: "timestamp", // Sort Key
  title: "string",
  description: "string",
  start_date: "ISO 8601",
  end_date: "ISO 8601",
  location: "string",
  organizer_id: "uuid",
  organizer_email: "string",
  is_public: boolean,
  max_attendees: number,
  created_at: "timestamp",
  updated_at: "timestamp"
}

// Invitation Model
{
  id: "uuid",              // Partition Key
  event_id: "uuid",        // Sort Key / GSI Partition Key
  invitee_email: "string", // GSI Sort Key
  invitee_name: "string",
  sent_at: "timestamp",
  status: "sent|delivered|failed"
}

// RSVP Model
{
  invitation_id: "uuid",   // Partition Key
  event_id: "uuid",        // Sort Key / GSI Partition Key
  response: "accept|maybe|decline",
  response_at: "timestamp",
  notes: "string"
}
```

### List of Tasks to be Completed

```yaml
Task 1 - Database Schema Setup:
MODIFY dynamo.js:
  - ADD createEventsTables() function
  - ADD events CRUD operations following existing patterns
  - ADD invitations CRUD operations
  - ADD rsvps CRUD operations
  - PRESERVE existing table operations

Task 2 - Core Models:
CREATE models/event.js:
  - MIRROR pattern from: models/user.js
  - ADD validation for dates, emails, required fields
  - ADD helper methods for date formatting

CREATE models/invitation.js:
  - ADD email validation using existing sanitizeInput pattern
  - ADD status tracking methods

CREATE models/rsvp.js:
  - ADD response validation (accept/maybe/decline only)
  - ADD timestamp helpers

Task 3 - Email Service:
CREATE services/email-service.js:
  - INTEGRATE AWS SES using existing AWS config from dynamo.js
  - ADD .ics file generation using ical-generator
  - ADD email template rendering
  - HANDLE SES error responses and retries

Task 4 - Business Logic Services:
CREATE services/calendar-service.js:
  - ADD event creation with validation
  - ADD event editing with authorization checks
  - ADD event deletion with cascade to invitations/RSVPs
  - MIRROR error handling from existing dynamo.js patterns

CREATE services/invite-service.js:
  - ADD bulk invitation sending
  - ADD RSVP processing
  - ADD notification logic for organizers
  - INTEGRATE with email-service

Task 5 - Express Routes:
MODIFY app.js:
  - ADD /events/* routes following existing pattern
  - ADD /invites/* routes for RSVP handling
  - ADD /dashboard route for user event management
  - PRESERVE existing authentication middleware patterns
  - ADD new isEventOrganizer middleware for event management

Task 6 - Enhanced Admin Interface:
MODIFY views/admin.handlebars:
  - ADD event management section following existing dropdown pattern
  - ADD invitation oversight features
  - PRESERVE existing admin functionality

Task 7 - User-Facing Views:
CREATE views/user-dashboard.handlebars:
  - MIRROR layout pattern from admin.handlebars
  - ADD event creation form
  - ADD my events listing
  - ADD my invitations listing

CREATE views/create-event.handlebars:
  - FOLLOW form patterns from admin.handlebars
  - ADD date pickers using existing Flatpickr integration
  - ADD invite list management

CREATE views/event-details.handlebars:
  - ADD event information display
  - ADD RSVP status tracking
  - ADD organizer controls (edit/cancel)

Task 8 - Enhanced Calendar Frontend:
MODIFY views/teamschedule.handlebars:
  - ENHANCE FullCalendar configuration
  - ADD event creation on date click
  - ADD event details popup
  - PRESERVE existing calendar functionality

CREATE public/js/calendar-enhanced.js:
  - ADD interactive event creation
  - ADD RSVP handling from calendar view
  - FOLLOW existing admin.js patterns for form management

Task 9 - API Endpoints:
MODIFY app.js:
  - ADD /api/events endpoint for FullCalendar
  - ADD /api/rsvp endpoint for AJAX responses
  - ADD /api/user/events for dashboard
  - FOLLOW existing /students API patterns

Task 10 - Authentication & Authorization:
ADD middleware functions to app.js:
  - ADD isEventOrganizer() middleware
  - ADD canManageEvent() helper
  - PRESERVE existing isUserValid and hasAuth patterns
```

### Integration Points

```yaml
DATABASE:
  - tables: "jcesports-db-events, jcesports-db-invitations, jcesports-db-rsvps"
  - GSIs: "event-id-index for invitations, event-id-index for rsvps"

CONFIG:
  - add to: .env file
  - variables: "SES_REGION, SES_FROM_EMAIL, INVITE_BASE_URL"

ROUTES:
  - modify: app.js
  - pattern: "Follow existing route organization with middleware chains"

EMAIL:
  - service: AWS SES
  - integration: "Extend existing AWS config from dynamo.js"
```

## Validation Loop

### Level 1: Syntax & Style

```bash
# Run these FIRST - fix any errors before proceeding
node app.js --check-syntax     # Basic Node.js syntax validation
npm install                    # Ensure all dependencies resolve

# Expected: No syntax errors, successful dependency installation
```

### Level 2: Unit Tests

```javascript
// CREATE tests/calendar-service.test.js
const { createEvent, sendInvitations } = require('../services/calendar-service');

describe('Event Creation', () => {
  test('creates valid event with required fields', async () => {
    const eventData = {
      title: 'Test Tournament',
      start_date: '2024-12-01T10:00:00',
      end_date: '2024-12-01T18:00:00',
      organizer_id: 'test-user-id'
    };
    
    const result = await createEvent(eventData);
    expect(result.id).toBeDefined();
    expect(result.title).toBe('Test Tournament');
  });
  
  test('rejects event with invalid date format', async () => {
    const eventData = {
      title: 'Invalid Event',
      start_date: 'invalid-date',
      organizer_id: 'test-user-id'
    };
    
    await expect(createEvent(eventData)).rejects.toThrow('Invalid date format');
  });
});
```

```bash
# Install testing framework
npm install --save-dev jest
# Run and iterate until passing:
npm test
```

### Level 3: Integration Test

```bash
# Start the application
node app.js

# Test event creation endpoint
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your-session-cookie" \
  -d '{
    "title": "Integration Test Event",
    "start_date": "2024-12-01T10:00:00",
    "end_date": "2024-12-01T18:00:00",
    "invitees": ["test@example.com"]
  }'

# Expected: {"success": true, "event_id": "uuid"}

# Test calendar endpoint
curl http://localhost:3000/json_calendar

# Expected: JSON array including new events with invite counts
```

### Level 4: Email & Calendar Validation

```bash
# Test email delivery (requires SES setup)
node -e "
const emailService = require('./services/email-service');
emailService.sendInvite({
  to: 'test@example.com',
  event: {
    title: 'Test Event',
    start_date: '2024-12-01T10:00:00',
    end_date: '2024-12-01T18:00:00'
  }
}).then(console.log).catch(console.error);
"

# Validate .ics file generation
node -e "
const ical = require('ical-generator');
const cal = ical({name: 'Test Calendar'});
cal.createEvent({
  start: new Date('2024-12-01T10:00:00'),
  end: new Date('2024-12-01T18:00:00'),
  summary: 'Test Event'
});
console.log(cal.toString());
"

# Expected: Valid iCalendar format output
```

## Final Validation Checklist

- [ ] All new routes accessible and respond correctly
- [ ] Events appear in calendar view immediately after creation
- [ ] Email invitations sent successfully with .ics attachments
- [ ] RSVP responses update database and notify organizers
- [ ] Admin dashboard shows all events with management options
- [ ] User dashboard shows personal events and invitations
- [ ] Authentication properly restricts access to appropriate features
- [ ] Error handling provides meaningful feedback to users
- [ ] Database operations handle edge cases (duplicate events, invalid IDs)
- [ ] Performance acceptable with realistic data volumes (tested with 50+ events)

## Anti-Patterns to Avoid

- ❌ Don't create new authentication patterns - use existing session middleware
- ❌ Don't bypass input sanitization - extend existing sanitizeInput function
- ❌ Don't hardcode email templates - make them configurable
- ❌ Don't ignore DynamoDB best practices - use appropriate partition/sort keys
- ❌ Don't break existing calendar functionality - enhance, don't replace
- ❌ Don't skip error handling - follow existing patterns for consistency
- ❌ Don't use synchronous operations for external services (email, database)

---

**PRP Confidence Score: 8/10**

This PRP provides comprehensive context including existing code patterns, specific implementation tasks, and validation steps. The main risks are AWS SES configuration complexity and FullCalendar integration challenges, but these are well-documented with fallback approaches.