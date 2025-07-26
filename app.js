const express = require('express');
var app = express();
var handlebars = require('express-handlebars').create({defaultLayout: 'main'});
const { getStudents, getStudentById, addOrUpdateStudent, deleteStudent, checkIfEmail, addOrUpdateRegistration, getUsers, deleteUserFromDB, getCalendar, deleteEvent, addOrUpdateCalendarEvent } = require('./dynamo');
const calendarService = require('./services/calendar-service');
const inviteService = require('./services/invite-service');
const bcrypt = require('bcrypt');

// TODO: Randomize salt rounds
const saltRounds = 10;
const bodyParser = require('body-parser');
const session = require('express-session');

// const passport = require('passport');
const User = require('./models/user');
const { v4: uuidv4 } = require('uuid');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.json());
const crypto = require('crypto');
//bcrypt
const secretKey = crypto.randomBytes(32).toString('hex');

// Render Engines
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('port', process.env.PORT || 3000);

app.use(session({
    secret: secretKey,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 // 1 hour
    }
  }));

// RENDER TO FETCH INFO FROM DYNAMODB
app.get('/students', isUserValid, hasAuth, async (req, res) => {
    try {
        const students = await getStudents();
        res.json(students);
    } catch (error) {
        console.error(err);
        res.status(500).json({err: 'Something went wrong'});
    }
});

app.get('/json_calendar', async (req, res) => {
    try {
        const events = await getCalendar();
        res.json(events)
    } catch (error) {
        console.error(error);
        res.status(500).json({err: 'Something went wrong'});
    }
})

// Enhanced calendar endpoint for new event system
app.get('/api/events', async (req, res) => {
    try {
        const user = req.session.user;
        const includePrivate = user && user.auth === 'admin';
        
        const result = await calendarService.getEventsForCalendar(user?.id, includePrivate);
        
        if (result.success && !result.shouldFallback && result.events.length > 0) {
            // New system has events, use them
            res.json(result.events);
        } else {
            // Fall back to old calendar system
            console.log('Falling back to old calendar system');
            try {
                const oldEvents = await getCalendar();
                res.json(oldEvents || []);
            } catch (fallbackError) {
                console.error('Old calendar system also failed:', fallbackError);
                // Return empty array rather than error to keep calendar working
                res.json([]);
            }
        }
    } catch (error) {
        console.error('Error getting calendar events:', error);
        // Final fallback to old system
        try {
            const oldEvents = await getCalendar();
            res.json(oldEvents || []);
        } catch (fallbackError) {
            console.error('All calendar systems failed:', fallbackError);
            res.json([]); // Return empty array to keep calendar working
        }
    }
})

// User dashboard route
app.get('/dashboard', isUserValid, async (req, res) => {
    try {
        const user = req.session.user;
        const isLoggedIn = true;
        
        // Get user's events and invitations with fallback
        let userEvents = { success: true, events: [] };
        let userInvitations = { success: true, invitations: [] };
        
        try {
            userEvents = await calendarService.getEventsByUser(user.id);
        } catch (error) {
            console.log('User events not available:', error.message);
        }
        
        try {
            userInvitations = await inviteService.getUserInvitations(user.email);
        } catch (error) {
            console.log('User invitations not available:', error.message);
        }

        const template = req.path.slice(1);
        res.render(template, { 
            isLoggedIn,
            user,
            userEvents: userEvents.success ? userEvents.events : [],
            userInvitations: userInvitations.success ? userInvitations.invitations : []
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).render('500');
    }
})

// Create event routes
app.get('/create-event', isUserValid, (req, res) => {
    const isLoggedIn = req.session.user ? true : false;
    const template = req.path.slice(1);
    res.render(template, { isLoggedIn });
});

app.post('/create-event', isUserValid, async (req, res) => {
    try {
        const user = req.session.user;
        const eventData = {
            title: sanitizeInput(req.body.title),
            description: sanitizeInput(req.body.description),
            start_date: req.body.start_date,
            end_date: req.body.end_date,
            location: sanitizeInput(req.body.location),
            is_public: req.body.is_public === 'true',
            max_attendees: req.body.max_attendees ? parseInt(req.body.max_attendees) : null
        };

        const result = await calendarService.createEvent(eventData, user);
        
        if (result.success) {
            // Send invitations if provided
            if (req.body.invitees && req.body.invitees.trim()) {
                const inviteeList = req.body.invitees.split(',').map(email => email.trim());
                await inviteService.createInvitations(result.event.id, result.event.created_at, inviteeList, user);
            }
            
            req.session.actionFeedback = {error: `Event "${result.event.title}" created successfully!`, refresh: "You may need to refresh."};
            res.redirect('/dashboard');
        } else {
            res.render('create-event', { 
                isLoggedIn: true,
                errors: result.errors || [result.error]
            });
        }
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).render('500');
    }
})

// Event details route - dynamic for both old and new events
app.get('/events/:id', async (req, res) => {
    try {
        const eventId = req.params.id;
        const user = req.session.user;
        const isLoggedIn = !!user;
        
        // First, try to get event from new system
        let eventData = null;
        let isNewEvent = false;
        
        try {
            // Try new events table (this will fail if table doesn't exist or event not found)
            // Convert string ID to number for new system
            const numericEventId = parseInt(eventId);
            if (!isNaN(numericEventId)) {
                const result = await calendarService.getEventDetails(numericEventId, '');
                if (result.success) {
                    eventData = result;
                    isNewEvent = true;
                }
            }
        } catch (error) {
            console.log('Event not found in new system, trying old system');
        }
        
        // If not found in new system, try old calendar system
        if (!eventData) {
            try {
                const oldEvents = await getCalendar();
                const oldEvent = oldEvents.find(event => event.id === eventId);
                
                if (oldEvent) {
                    // Convert old event to new format for display
                    eventData = {
                        success: true,
                        event: {
                            id: oldEvent.id,
                            title: oldEvent.title,
                            start_date: oldEvent.start,
                            end_date: oldEvent.end,
                            description: '',
                            location: '',
                            organizer_email: 'Unknown',
                            is_public: true,
                            created_at: oldEvent.start
                        },
                        invitations: [],
                        rsvps: [],
                        rsvpSummary: { accept: 0, maybe: 0, decline: 0, no_response: 0, total: 0 },
                        totalInvited: 0
                    };
                    isNewEvent = false;
                }
            } catch (error) {
                console.error('Error getting old event:', error);
            }
        }
        
        if (eventData && eventData.success) {
            const template = 'event-details';
            res.render(template, { 
                isLoggedIn,
                event: eventData.event,
                invitations: eventData.invitations || [],
                rsvps: eventData.rsvps || [],
                rsvpSummary: eventData.rsvpSummary || { accept: 0, maybe: 0, decline: 0, no_response: 0, total: 0 },
                totalInvited: eventData.totalInvited || 0,
                canManage: user && isNewEvent && calendarService.canUserManageEvent(eventData.event, user),
                isOldEvent: !isNewEvent
            });
        } else {
            res.status(404).render('404');
        }
    } catch (error) {
        console.error('Error getting event details:', error);
        res.status(500).render('500');
    }
})

// RSVP handling routes
app.get('/rsvp/:invitationId/:eventId', async (req, res) => {
    try {
        const { invitationId, eventId } = req.params;
        const response = req.query.response; // accept, maybe, decline
        
        if (response && ['accept', 'maybe', 'decline'].includes(response)) {
            // Process the RSVP directly
            const result = await inviteService.processRSVP(invitationId, eventId, response);
            
            if (result.success) {
                res.render('invite-response', {
                    success: true,
                    message: result.message,
                    response: response
                });
            } else {
                res.render('invite-response', {
                    success: false,
                    error: result.error
                });
            }
        } else {
            // Show RSVP form
            res.render('invite-response', {
                invitationId: invitationId,
                eventId: eventId,
                showForm: true
            });
        }
    } catch (error) {
        console.error('Error handling RSVP:', error);
        res.status(500).render('500');
    }
})

app.post('/rsvp/:invitationId/:eventId', async (req, res) => {
    try {
        const { invitationId, eventId } = req.params;
        const { response, notes, responder_name } = req.body;
        
        const result = await inviteService.processRSVP(
            invitationId, 
            eventId, 
            response, 
            notes,
            { name: sanitizeInput(responder_name) }
        );
        
        if (result.success) {
            res.render('invite-response', {
                success: true,
                message: result.message,
                response: response
            });
        } else {
            res.render('invite-response', {
                success: false,
                error: result.error,
                invitationId: invitationId,
                eventId: eventId,
                showForm: true
            });
        }
    } catch (error) {
        console.error('Error processing RSVP:', error);
        res.status(500).render('500');
    }
})

// API endpoint for sending invitations
app.post('/api/send-invitations', isUserValid, isEventOrganizer, async (req, res) => {
    try {
        const user = req.session.user;
        const { eventId, createdAt, invitees } = req.body;
        
        const inviteeList = Array.isArray(invitees) ? invitees : invitees.split(',').map(email => email.trim());
        
        const result = await inviteService.createInvitations(eventId, createdAt, inviteeList, user);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error sending invitations:', error);
        res.status(500).json({error: 'Failed to send invitations'});
    }
})

// API endpoint for RSVP summary
app.get('/api/events/:eventId/rsvp-summary', async (req, res) => {
    try {
        const { eventId } = req.params;
        const result = await inviteService.getEventRSVPSummary(eventId);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('Error getting RSVP summary:', error);
        res.status(500).json({error: 'Failed to get RSVP summary'});
    }
})



// SAMPLE CODE FOR PULLING USERS FROM DATABASE
// app.get('/teamlist', async (req, res) => {
//     try {
//         const students = await getStudents();
//         const items = students["Items"];
//         const template = req.path.slice(1);
//         res.render(template, { items }) // Does not render the text. maybe a json?
//     } catch (error) {
//         console.error(error.message);
//     }
// });

app.get('/admin', isUserValid, hasAuth, async (req, res) => {
    const actionFeedback = req.session.actionFeedback || null;
    req.session.actionFeedback = null;
    const isLoggedIn = req.session.user ? true : false;

    try {
        // Fetch Players from List
        const players = await getStudents();
        const playerList = players["Items"];

        // Fetch Calendar events
        const calEvents = await getCalendar();

        const users = await getUsers();
        const userList = users["Items"];
        const template = req.path.slice(1);
        res.render(template, {userList, playerList, calEvents, actionFeedback, isLoggedIn})
    } catch (error) {
        console.error(err);
        res.status(500).json({err: 'Something went wrong'});
    }
});

app.get('/students/:id', isUserValid, hasAuth, async (req, res) => {
    const id = req.params.id;
    try {
        const students = await getStudentById(id);
        res.json(students);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Something went wrong'});
    }
});

app.post('/students', isUserValid, hasAuth, async (req, res) => {
    const student = req.body;
    try {
        const newStudent = await addOrUpdateStudent(student);
        res.json(newStudent);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Something went wrong'});
    }
});

app.put('/students/:id', isUserValid, hasAuth, async (req, res) => {
    const student = req.body;
    const {id} = req.params;
    student.id = id;
    try {
        const updatedStudent = await addOrUpdateStudent(student);
        res.json(updatedStudent);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Something went wrong'});
    }
});

app.delete('/students/:id', isUserValid, hasAuth, async (req, res) => {
    const {id} = req.params;
    try {
        res.json(await deleteStudent(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Something went wrong'});
    }
});

app.get('/teamlist', async (req, res) => {
    try {
        const students = await getStudents();
        const items = students["Items"];
        const template = req.path.slice(1);
        res.render(template, { items }) // Does not render the text. maybe a json?
    } catch (error) {
        console.error(error.message);
    }
});



// app.get('/teamschedule', async (req, res) => {
//     try {
//         const template = req.path.slice(1);
//         res.render()
//     } catch (error) {
//         console.error(error.message);
//     }
// })

// I THINK isUserValid and renderTemplate are trying to achieve the same goals
// One is a middleware, the other is being passed into the render.
// If the user is not valid (only on pages we want, redirect to /login.)
// What if the user is valid but has invalid credentials?
// We don't need to check every page if a user is valid. But if we're passing 

// TODO: Rename renderTemplate, add an argument to pass in called "dir" which gets the page?
function renderTemplate(req, res) {
    const template = req.path.slice(1);
    const isLoggedIn = req.session.user ? true : false;
    res.render(template, { isLoggedIn });
}

// app.get('/admin', isUserValid, hasAuth, renderTemplate);
// app.get('/teamlist', renderTemplate);
app.get('/about', renderTemplate);
app.get('/register', renderTemplate);
app.get('/login', renderTemplate);
app.get('/history', renderTemplate);
app.get('/teamschedule', renderTemplate);
app.get('/awards', renderTemplate);

app.get('/logout', isUserValid, async (req, res) => {
    req.session.user = "";
    console.log("User Logged Out.")
    res.redirect('/');
    // Error handling?
});

app.post('/login', async (req, res) => {
    const email = req.body.email;
    const errorTemplate = req.path.slice(1);
    try {
        const checkEmail = await checkIfEmail(email);
        if (checkEmail.Count === 0) {
            console.log("No Email Found");
                const emailError = {"error": "Incorrect email or password."};
                res.render(errorTemplate, { emailError });
            } else {
            const items = checkEmail.Items;
            const item = items[0];
            const storedPassword = item.password;
            bcrypt.compare(sanitizeInput(req.body.password), storedPassword, (err, result) => {
                if (err) {
                    console.error('Error comparing passwords:', err);
                    const emailError = {"error": "Internal Server Error."};
                    res.render(errorTemplate, { emailError });
                } else if (result) {
                    const userInstance = new User({
                        id: item.id,
                        email: item.email,
                        auth: item.auth
                    });
                    console.log('Login Successful');
                    req.session.user = userInstance;
                    res.redirect('/');
                } else {
                    console.error('Incorrect password');
                    const emailError = {"error": "Incorrect email or password."};
                    res.render(errorTemplate, { emailError });
                }
            });
        }
    } catch (error) {
        console.error(error);
        const emailError = {"error": "Something went wrong!"};
        res.render(errorTemplate, { emailError });
    }
});

// User Registration (DynamoDB)
app.post('/register', async (req, res) => {
    const email = req.body.email;
    const errorTemplate = req.path.slice(1);
    try {
        const checkEmail = await checkIfEmail(email);
        if (checkEmail.Count > 0 ) {
            console.log("Email Already In Table!");
            const emailError = ["Email Already Registered!"];
            res.render(errorTemplate, { emailError });
            return;
        } else {
            bcrypt.genSalt(saltRounds, function(err, salt) {
                bcrypt.hash(sanitizeInput(req.body.password), salt, function(err, hash) {
                    if (err) {
                        console.error('Error hashing password:', err);
                        res.status(500).send('Error hashing password!');
                        return;
                    }
                    const hashPassword = hash;
                    const id = uuidv4();
                    const newUserAuth = "user"
                    const userRegister = {
                        id: id,
                        email: email,
                        password: hashPassword,
                        username: sanitizeInput(req.body.username),
                        auth: newUserAuth
                    };

                    const userInstance = new User({
                        id: id,
                        email: email,
                        auth: newUserAuth
                    });
                    
                    
                    try {
                        console.log('User Registration Successful, Logging in User as', email);
                        addOrUpdateRegistration(userRegister);
                        const emailError = ["Registration Successful."];
                        res.render(errorTemplate, { emailError });
                        // Login the user here after registration
                        req.session.user = userInstance;

                    } catch (error) {
                        console.error(error);
                        res.status(500).json({error: 'Error inserting user!'});
                    }
                });
            })
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Something went wrong.'});
    }
});

// ADMIN DASHBOARD
//isUserValid, hasAuth,
app.post('/admin', isUserValid, hasAuth, async (req, res) => {
    // Make this more than just posting a new user. Make it check to see if that's what the admin wanted. If it was, then post it.
    const post_type = req.body.post_type;
    
    if ( post_type == "create_player") {
        const playerCreation = {
            id: uuidv4(),
            number: sanitizeInput(req.body.playernumber),
            name: sanitizeInput(req.body.playername),
            gamertag: sanitizeInput(req.body.playergamertag),
            team: sanitizeInput(req.body.playerteam),
            position: sanitizeInput(req.body.playerposition),
            grade: sanitizeInput(req.body.playergrade),
            hometown_highschool: sanitizeInput(req.body.playerhometown),
            country_code: sanitizeInput(req.body.country)
        }
        try {
            addOrUpdateStudent(playerCreation);
            console.log(`Successfully Created Player: ${playerName}`);
            req.session.actionFeedback = {error: `Successfully Created Player: ${playerName}`, refresh: "You may need to refresh."};
        } catch (error) {
            console.error(error);
            console.log(`Error Creating Player: ${playerName}`);
            req.session.actionFeedback = {error: `Error Creating Player: ${playerName}`, refresh: "You may need to refresh."};
        }
        res.redirect('/admin');

    } else if ( post_type == "create_event" ) {
        const eventTitle = req.body.title;
        const user = req.session.user;

        const eventData = {
            title: eventTitle,
            description: sanitizeInput(req.body.description) || '',
            start_date: req.body.start,
            end_date: req.body.end,
            location: sanitizeInput(req.body.location) || '',
            is_public: req.body.is_public === 'true',
            max_attendees: req.body.max_attendees ? parseInt(req.body.max_attendees) : null
        };
        
        console.log('Admin form data received:', {
            title: eventTitle,
            description: req.body.description,
            start: req.body.start,
            end: req.body.end,
            location: req.body.location,
            is_public: req.body.is_public,
            max_attendees: req.body.max_attendees
        });

        try {
            const result = await calendarService.createEvent(eventData, user);
            if (result.success) {
                // Send invitations if provided
                if (req.body.invitees && req.body.invitees.trim()) {
                    try {
                        const inviteeList = req.body.invitees.split(',').map(email => email.trim());
                        const inviteResult = await inviteService.createInvitations(result.event.id, result.event.created_at, inviteeList, user);
                        
                        if (inviteResult.success) {
                            console.log(`Successfully Created Event: ${eventTitle} and sent ${inviteResult.emailsSent || 0} invitations`);
                            req.session.actionFeedback = {error: `Successfully Created Event: ${eventTitle} and sent ${inviteResult.emailsSent || 0} invitations`, refresh: "You may need to refresh."};
                        } else {
                            console.log(`Event created but failed to send invitations: ${inviteResult.error}`);
                            req.session.actionFeedback = {error: `Event created successfully but failed to send invitations: ${inviteResult.error}`, refresh: "You may need to refresh."};
                        }
                    } catch (inviteError) {
                        console.error('Error sending invitations:', inviteError);
                        req.session.actionFeedback = {error: `Event created successfully but failed to send invitations`, refresh: "You may need to refresh."};
                    }
                } else {
                    console.log(`Successfully Created Event: ${eventTitle}`);
                    req.session.actionFeedback = {error: `Successfully Created Event: ${eventTitle}`, refresh: "You may need to refresh."};
                }
            } else {
                console.log(`Failed to Create Event: ${eventTitle}`, result.error);
                req.session.actionFeedback = {error: `Failed to Create Event: ${eventTitle} - ${result.error}`, refresh: "You may need to refresh."};
            }
            res.redirect('/admin');
        } catch (error) {
            console.error('Error in admin event creation:', error);
            console.log(`Failed to Create Event: ${eventTitle}`);
            req.session.actionFeedback = {error: `Failed to Create Event: ${eventTitle} - ${error.message}`, refresh: "You may need to refresh."};
            res.redirect('/admin');
        }

    } else if (post_type == "delete_event" && req.body.eventId && req.body.eventTitle && req.body.eventStart) {
        const eventId = req.body.eventId;
        const eventTitle = req.body.eventTitle;
        const start = req.body.eventStart;

        try {
            await deleteEvent(eventId, start);
            console.log(`Successfully Deleted Event: ${eventTitle}`);
            req.session.actionFeedback = {error: `Successfully Deleted Event: ${eventTitle}`, refresh: "You may need to refresh."};
            res.redirect('/admin');
        } catch (error) {
            console.error(error);
            console.error(error.__type);
            console.log(`Failed to Delete Event: ${eventTitle}`);
            req.session.actionFeedback = {error: `Failed to Deleted Event: ${eventTitle}`, refresh: "You may need to refresh."};
            res.redirect('/admin');
        }


    } else if (post_type == "delete_player" && req.body.playerId) {
        const playerId = req.body.playerId;
        const playerName = req.body.playerName;
        try {
            await deleteStudent(playerId);
            console.log(`Successfully Deleted Player: ${playerName}`);
            req.session.actionFeedback = {error: `Successfully Deleted Player: ${playerName}`, refresh: "You may need to refresh."};
            res.redirect('/admin');
        } catch (error) {
            console.error(error);
            console.error(error.__type);
            console.log(`Failed to Delete Player: ${playerName}`);
            req.session.actionFeedback = {error: `Failed to Deleted Player: ${playerName}`, refresh: "You may need to refresh."};
            res.redirect('/admin');
        }

    } else if (post_type == "delete_user" && req.body.userEmail && req.body.userId) {
        const userEmail = req.body.userEmail;
        const userId = req.body.userId;

        try {
            const user = req.session.user;
            const email = user.email;
            if (userEmail == email) {
                console.log("Attempting to delete own account");
                req.session.actionFeedback = {error: `You cannot delete your own account! ${userEmail}`};
                res.redirect('/admin');
                return
            }
            await deleteUserFromDB(userEmail, userId);
            console.log(`Successfully Deleted User Account: ${userEmail}`);
            req.session.actionFeedback = {error: `Successfully Deleted User Account: ${userEmail}`, refresh: "You may need to refresh."};
            res.redirect('/admin');
        } catch (error) {
            console.error(error);
            console.error(error.__type);
            console.log(`Failed to Delete User Account: ${userEmail}`);
            req.session.actionFeedback = {error: `Failed to Deleted User Account: ${userEmail}`, refresh: "You may need to refresh."};
            res.redirect('/admin');
        }
    } else if (post_type == "create_user") {
        const userEmail = sanitizeInput(req.body.userEmail)
        // Check if email already exists [done]
        // If not for either, create account, pull username, hash password, try to add it to the system
        // else, throw error.

        try {
            const checkEmail = await checkIfEmail(userEmail);
            if (checkEmail.Count === 0) {
                console.log("No Email Found, Proceeding");
                    
                bcrypt.genSalt(saltRounds, function(err, salt) {
                    bcrypt.hash(sanitizeInput(req.body.password), salt, function(err, hash) {
                        if (err) {
                            console.error('Error hasing password:', err);
                            res.status(500).send('Error Hashing Password!');
                            return;
                        }
                        const hashPassword = hash;
                        const id = uuidv4();
                        const userEmail = sanitizeInput(req.body.userEmail);
                        const username = sanitizeInput(req.body.userName);
                        const auth = sanitizeInput(req.body.auth);
                        const newUser = {
                            email: userEmail,
                            id: id,
                            auth: auth,
                            password: hashPassword,
                            username: username
                        }
                        addOrUpdateRegistration(newUser);
                        console.log('User Registration Successful. User created by email:', userEmail);
                        req.session.actionFeedback = {error: `Successfully Created User Account: ${userEmail}`, refresh: "You may need to refresh."};
                        res.redirect('/admin');
                    });
                });
                
                    // const emailError = {"error": "Incorrect email or password."};
                    // res.render(errorTemplate, { emailError });
            } else {
                // Sucess, do things here
                res.status(200).send("Email Already in System!");
                
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({error: 'Error inserting user!'});
        }
    }
});

// Define route to render the form page
app.get('/', (req, res) => {
    const isLoggedIn = req.session.user ? true : false;
    res.render('index', { isLoggedIn });
});

//custom 500: Server not Responding
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('500 - Server error!');
});

app.use((req, res) => {
    res.render('404');
});

// RENDER TO FETCH INFO FROM DYNAMODB
// RENDER TO FETCH INFO FROM DYNAMODB

function isUserValid(req, res, next) {
    try {
        if (!req.session.user || typeof req.session.user !== 'object') {
            throw new Error('Invalid user session!');
        }
        next();
    } catch (error) {
        console.error(error.message);
        res.status(401).redirect('/login');
    }
}

// Does user have auth for admin panel
// TODO fix so it doesn't pull user.auth from plain text but from the user's db-auth level--
function hasAuth(req, res, next) {
    try {
        const user = req.session.user;
        const auth = user.auth;

        if (auth !== "admin") { // Pull the user session auth (check against a salted hash instead of plain-text.)
            throw new Error("Unauthorized Admin Panel Attempted Access:");
        }
        console.log("Authorized Admin Panel Access:", user.email);
        next();
    } catch (error) {
        console.error(error.message, req.session.user.email);
        res.status(401).redirect('/');
    }
}

// Check if user can manage a specific event
function isEventOrganizer(req, res, next) {
    try {
        const user = req.session.user;
        if (!user) {
            throw new Error("No user session");
        }
        
        // Admin can manage any event
        if (user.auth === "admin") {
            next();
            return;
        }
        
        // Event organizer can manage their events (checked in service layer)
        next();
    } catch (error) {
        console.error("Event authorization error:", error.message);
        res.status(401).redirect('/login');
    }
}


app.listen(app.get('port'), function() {
    console.log('Started express app on http://localhost:' +
        app.get('port') + '; press Ctrl-C to terminate.');
});

function sanitizeInput(input) {
    return input.replace(/[^a-zA-Z0-9\-\_\.\@]/g, '');
}

// TODO:
// Make sure that the Admin href is showing if the user is logged in and has access from their auth.
// Make the email login not case sensitive.