const express = require('express');
var app = express();
var handlebars = require('express-handlebars').create({defaultLayout: 'main'});
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Render Engines
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('port', process.env.PORT || 3000);


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

function renderTemplate(req, res, next) {
const template = req.path.slice(1);
res.render(template);
}

app.get('/admin', renderTemplate);
app.get('/teamlist', renderTemplate);
app.get('/about', renderTemplate);
app.get('/register', renderTemplate);
app.get('/login', renderTemplate);

// USER LOGIN
app.post('/login', (req, res) => {
    const emailExistsQuery = 'SELECT * FROM users WHERE email = ?';
    const sanitizedEmail = sanitizeInput(req.body.email);
    connection.query(emailExistsQuery, [sanitizedEmail], (err, results) => {
        if (err) {
            res.send("Error parsing database for email.");
        } else if (results.length === 0) {
            console.error('Email not found');
            res.status(401).send('Incorrect email or password.');
        } else {
            const user = results[0];
            const hash = user.password;
      
            bcrypt.compare(sanitizeInput(req.body.password), hash, (err, result) => {
              if (err) {
                console.error('Error comparing passwords:', err);
                res.status(500).send('Internal server error.');
              } else if (result) {
                console.log('Login successful');
                // Implement session management and redirect to success page
              } else {
                console.error('Incorrect password');
                res.status(401).send('Incorrect email or password.');
              }
            });
          }
        });
      });

// USER REGISTRATION
app.post('/register', (req, res) => {
    const emailExistsQuery = 'SELECT * FROM users WHERE email = ?';
    const sanitizedEmail = sanitizeInput(req.body.email);
    connection.query(emailExistsQuery, [sanitizedEmail], (err, results) => {
        if (err) {
            res.send("Error parsing database.");
        } else if (results.length > 0) {
            res.send('Email already in use.');
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

                const sql = 'INSERT INTO users (username, email, password, authority) VALUES (?, ?, ?, ?)';
                connection.query(sql, [sanitizeInput(req.body.username), sanitizeInput(req.body.email), hashPassword, req.body.authority], (err, result) => {
                if (err) {
                    console.error('Error inserting user:', err);
                    res.status(500).send('Error!');
                    return;
                }
                res.status(200).send("Registration Successful");
            });
        });
      });
    }
  });
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

// app.use(admin.router);
// https://beta.adminbro.com/docs.html

app.listen(app.get('port'), function() {
    console.log('Started express app on http://localhost:' +
        app.get('port') + '; press Ctrl-C to terminate.');
});

function sanitizeInput(input) {
    return input.replace(/[^a-zA-Z0-9\-\_\.\@]/g, '');
  }