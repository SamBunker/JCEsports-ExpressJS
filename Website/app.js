const express = require('express');
var app = express();
var handlebars = require('express-handlebars').create({defaultLayout: 'main'});
const mysql = require('mysql');
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

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

app.get('/teamlist', (req, res) => {
    res.render('teamlist');
});

// Define route to handle form submission
app.post('/teamlist', (req, res) => {
    const email = req.body.email;

    // Insert the email into the database
    const sql = 'INSERT INTO subscribers (email) VALUES (?)';
    connection.query(sql, [email], (err, result) => {
        if (err) {
        console.error('Error inserting email:', err);
        res.status(500).redirect('/thank-you');
        return;
        }

        res.status(200).redirect('/thank-you');
    });
});

app.get('/thank-you', (req, res) => {
    res.render('thank-you');
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