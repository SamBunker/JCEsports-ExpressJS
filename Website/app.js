const express = require('express');
var app = express();
var handlebars = require('express-handlebars').create({defaultLayout: 'main'});
const { getStudents, getStudentById, addOrUpdateStudent, deleteStudent, checkIfEmail, addOrUpdateRegistration, getUsers } = require('./dynamo');
const mysql = require('mysql'); // Will phase this out for Dynamodb
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

app.get('/students', async (req, res) => {
    try {
        const students = await getStudents();
        res.json(students);
    } catch (error) {
        console.error(err);
        res.status(500).json({err: 'Something went wrong'});
    }
});

app.get('/users', async (req, res) => {
    try {
        const users = await getUsers();
        res.json(users);
    } catch (error) {
        console.error(err);
        res.status(500).json({err: 'Something went wrong'});
    }
});

// app.get('/students/test', async (req, res) => {
//     try {
//         const students = await getStudents();
//         data_list = json.loads(students);
//         for (person in data_list) {
//             if ("Sam" in person["name"].lower()) {
//                 res.json(person);
//                 break;
//             } else {
//                 res.message("No user found by that name!");
//             }
//         } 
//         // res.json(students);
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({error: 'Something went wrong'});
//     }
// });

app.get('/students/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const students = await getStudentById(id);
        res.json(students);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Something went wrong'});
    }
});

app.post('/students', async (req, res) => {
    const student = req.body;
    try {
        const newStudent = await addOrUpdateStudent(student);
        res.json(newStudent);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Something went wrong'});
    }
});

app.put('/students/:id', async (req, res) => {
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

app.delete('/students/:id', async (req, res) => {
    const {id} = req.params;
    try {
        res.json(await deleteStudent(id));
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Something went wrong'});
    }
})


// WILL BE PHASED OUT //
// WILL BE PHASED OUT //
// Connect to MySQL database
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'esports'
  });
  
connection.connect((err) => {
if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
}
console.log('Connected to MySQL database');
});
// WILL BE PHASED OUT //
// WILL BE PHASED OUT //

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

        if (auth !== "admin") { // Pull the user session auth
            throw new Error("Unauthorized Access! Admin Priviledges Required.");
            res.status(401).redirect('/');
        } 
        next();
    } catch (error) {
        console.error(error.message);
        res.status(401).redirect('/login');
    }
}
// app.get('/teamlist', async (req, res) => {
//     try {
//       const table = await getPlayers(connection);
//       res.render("teamlist", { list: async function() {
//         await getPlayers(connection);
//       } });
//     } catch (error) {
//       console.error(error);
//       res.status(500).send('Internal Server Error');
//     }
//   });

function renderTemplate(req, res, next) {
    const template = req.path.slice(1);
    res.render(template);
}

app.get('/admin', isUserValid, hasAuth, renderTemplate);
// app.get('/teamlist', renderTemplate);
app.get('/about', renderTemplate);
app.get('/register', renderTemplate);
app.get('/login', renderTemplate);
app.get('/history', renderTemplate);
app.get('/teamschedule', renderTemplate);
app.get('/awards', renderTemplate);

// USER LOGIN
// app.post('/login', (req, res) => {
//     const emailExistsQuery = 'SELECT * FROM users WHERE email = ?';
//     const sanitizedEmail = sanitizeInput(req.body.email);
//     connection.query(emailExistsQuery, [sanitizedEmail], (err, results) => {
//         if (err) {
//             res.send("Error parsing database for email.");
//         } else if (results.length === 0) {
//             console.error('Email not found');
//             res.status(401).send('Incorrect email or password.');
//         } else {
//             const user = results[0];
//             const hash = user.password;
// console.log(storedPassword);            
// console.log("Email Found!");
// res.json(checkEmail);


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
                        // id: id, To get total IDs, Grab the total scan of all, -1 and set that as the string for ID.
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
    const sql = 'INSERT INTO players (number, name, gamertag, team, position, grade, hometown_highschool, country_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    connection.query(sql, [sanitizeInput(req.body.playernumber), sanitizeInput(req.body.playername), sanitizeInput(req.body.playergamertag), 
        sanitizeInput(req.body.playerteam), sanitizeInput(req.body.playerposition), sanitizeInput(req.body.playergrade), 
        sanitizeInput(req.body.playerhometown), sanitizeInput(req.body.country)], (err, result) => {
        if (err) {
            console.error('Error inserting email:', err);
            res.status(500).send('Error!');
            return;
        }
        res.status(200).send('Thank you for submitting');
    });
});

// Define route to render the form page
app.get('/', (req, res) => {
    res.render('index');
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