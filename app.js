const express = require('express');
var app = express();
var handlebars = require('express-handlebars').create({defaultLayout: 'main'});
const { getStudents, getStudentById, addOrUpdateStudent, deleteStudent, checkIfEmail, addOrUpdateRegistration, getUsers, deleteUserFromDB, getUserFromDB, getCalendar, addOrUpdateCalendarEvent } = require('./dynamo');
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

    try {
        const users = await getUsers();
        const items = users["Items"];
        const template = req.path.slice(1);
        res.render(template, {items, actionFeedback})
        // res.json(users);
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

app.get('/admin', isUserValid, hasAuth, renderTemplate);
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
            res.status(200).send("Creation Successful");
        } catch (error) {
            console.error(error);
            res.status(500).json({error: 'Error inserting student!'});
        }
    } else if ( post_type == "create_event" ) {
        const newEvent = {
            id: uuidv4(),
            title: sanitizeInput(req.body.title),
            start: sanitizeInput(req.body.start),
            end: sanitizeInput(req.body.end)
        }
        try {
            addOrUpdateCalendarEvent(newEvent);
            res.status(200).send("Calendar Event Added!");
        } catch (error) {
            console.error(error);
            res.status(500).json({error: 'Error inserting event!'}); 
        }

    } else if (post_type == "delete_user" && req.body.userEmail && req.body.userId) {
        const userEmail = req.body.userEmail;
        const userId = req.body.userId;
        // console.log(await getUserFromDB(userEmail));
        console.log("userEmail selected:", userEmail);
        console.log("userId:", userId);
        console.log("Type of userEmail:", typeof userEmail);
        console.log("CHECK #1");

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
            console.log("CHECK #2");
            req.session.actionFeedback = {error: `Successfully Deleted User Account: ${userEmail}`, refresh: "You may need to refresh."};
            res.redirect('/admin');
        } catch (error) {
            console.error(error);
            console.error(error.__type);
            console.log("CHECK #ERROR");
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