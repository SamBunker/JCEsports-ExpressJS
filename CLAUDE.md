# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Setup and Environment

This is a Node.js Express application for Juniata College Esports website that uses AWS DynamoDB for data storage and Handlebars for templating.

### Required Environment Variables (.env file)
```
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=your_region
PORT=3000
```

### Running the Application
- **Local development**: `node app.js`
- **Docker**: `docker run -v "D:/Development Projects/JCEsports-ExpressJS/:/app" -w /app -p 3000:3000 node:18-slim bash -c "npm audit fix && npm install && node app.js"`
- Application runs on port 3000 by default

## Architecture Overview

### Core Components
- **app.js**: Main Express application with all routes, middleware, and server logic
- **dynamo.js**: AWS DynamoDB client and database operations
- **models/user.js**: User model constructor for session management
- **views/**: Handlebars templates with main.handlebars layout
- **public/**: Static assets (CSS, JS, images)

### Database Tables (DynamoDB)
- `jcesports-db`: Player/student records
- `jcesports-db-users`: User authentication and authorization
- `jcesports-db-calendar-events`: Calendar events for scheduling

### Authentication & Authorization
- Session-based authentication using express-session
- Bcrypt password hashing with salt rounds
- Two middleware functions:
  - `isUserValid()`: Validates user session exists
  - `hasAuth()`: Checks admin-level authorization
- User roles: "user" and "admin"

### Key Features
1. **Player Management**: CRUD operations for esports team players
2. **User Management**: Registration, login, admin user creation/deletion
3. **Calendar Events**: Create, read, delete calendar events
4. **Admin Dashboard**: Protected admin panel for managing users, players, and events

### Route Structure
- `/`: Home page
- `/login`, `/register`: Authentication pages
- `/admin`: Protected admin dashboard (requires admin auth)
- `/teamlist`: Public team roster display
- `/students/*`: Protected API endpoints for player CRUD operations
- Static pages: `/about`, `/history`, `/teamschedule`, `/awards`

### Security Considerations
- Input sanitization function: `sanitizeInput()` removes special characters
- Password hashing with bcrypt
- Session management with secure cookies
- Admin-only routes protected by middleware
- Prevention of self-account deletion in admin panel

### Development Notes
- No package.json scripts defined - use `node app.js` directly
- Uses Handlebars templating engine with Bootstrap 5 CSS framework
- Error handling includes custom 404 and 500 pages
- Session timeout set to 1 hour
- TODO comments indicate areas for improvement (salt randomization, case-insensitive email, auth improvements)

## Custom Claude Commands

This repository includes extensive custom commands in `.claude/commands/` for enhanced development workflows:

### Development Commands
- `/smart-commit` - Analyze changes and create conventional commits
- `/create-pr` - Generate well-structured pull requests with templates
- `/onboarding` - Comprehensive project analysis for new developers
- `/new-dev-branch` - Create properly named feature branches
- `/debug-RCA` - Root cause analysis for debugging

### Code Quality Commands  
- `/review-general` - Comprehensive code review of changes
- `/review-staged-unstaged` - Review specific staged/unstaged changes
- `/refactor-simple` - Safe refactoring assistance

### PRP (Project Research & Planning) System
- `/prp-base-create` - Generate comprehensive implementation plans
- `/prp-base-execute` - Execute PRP-based implementations
- `/prp-planning-create` - Create planning-focused PRPs
- `/prp-spec-create` - Generate technical specifications
- `/task-list-init` - Initialize structured task management

### Git Operations
- `/conflict-resolver-general` - Resolve merge conflicts
- `/conflict-resolver-specific` - Target specific conflict resolution  
- `/smart-resolver` - Intelligent conflict resolution

### TypeScript-Specific Commands
- `/TS-create-base-prp` - TypeScript-focused PRP creation
- `/TS-execute-base-prp` - Execute TypeScript PRPs
- `/TS-review-general` - TypeScript code reviews

### Experimental/Rapid Development
- Various parallel processing and hackathon-focused commands
- Research and validation tools
- User story rapid development

These commands provide structured workflows for complex development tasks and can be invoked using `/command-name` syntax.