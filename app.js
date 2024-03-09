const express = require('express');
var app = express();
var handlebars = require('express-handlebars').create({defaultLayout: 'main'});
const { getStudents, getStudentById, addOrUpdateStudent, deleteStudent, checkIfEmail, addOrUpdateRegistration, getUsers, getCalendar, addOrUpdateCalendarEvent } = require('./dynamo');
const bcrypt = require('bcrypt');
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
      maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
  }));

// RENDER TO FETCH INFO FROM DYNAMODB
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

app.get('/users', isUserValid, hasAuth, async (req, res) => {
    try {
        const users = await getUsers();
        res.json(users);
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
function hasAuth(req, res, next) {
    try {
        const user = req.session.user;
        const auth = user.auth;

        // if (auth !== "admin") { // Pull the user session auth
        //     throw new Error("Unauthorized Access! Admin Priviledges Required.");
        //     res.status(401).redirect('/');
        // } 
        next();
    } catch (error) {
        console.error(error.message);
        res.status(401).redirect('/login');
    }
}

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

function renderTemplate(req, res, next) {
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

app.post('/login', async (req, res) => {
    const email = req.body.email;
    try {
        const checkEmail = await checkIfEmail(email);
        if (checkEmail.Count === 0) {
            console.log("No Email Found");
            res.status(401).send('Incorrect email or password.');
        } else {
            const items = checkEmail.Items;
            const item = items[0];
            const storedPassword = item.password;
            bcrypt.compare(sanitizeInput(req.body.password), storedPassword, (err, result) => {
                if (err) {
                    console.error('Error comparing passwords:', err);
                    res.status(500).send('Internal server error.');
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
                    res.status(401).send('Incorrect email or password.');
                }
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Something went wrong'});
    }
});

// User Registration (DynamoDB)
app.post('/register', async (req, res) => {
    const email = req.body.email;
    try {
        const checkEmail = await checkIfEmail(email);
        if (checkEmail.Count > 0 ) {
            console.log("Email Already In Table!");
            res.status(401).send('Email Already in Database!') //TODO: Will need changed since this releases all emails that are already registered.
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
                    const userRegister = {
                        id: id,
                        email: email,
                        password: hashPassword,
                        username: sanitizeInput(req.body.username),
                        auth: "user"
                    };
                    
                    try {
                        addOrUpdateRegistration(userRegister);
                        res.status(200).send("Registration Successful");
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
app.post('/admin', (req, res) => {
    // Make this more than just posting a new user. Make it check to see if that's what the admin wanted. If it was, then post it.
    const post_type = sanitizeInput(req.body.adminOption);
    
    if ( post_type == "create_user") {
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
    res.status(404).send('404 - Not found');
});

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