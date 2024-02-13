const express = require('express')
const mysql = require('mysql2')
const bcrypt = require('bcrypt')
const uuid = require('uuid');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Generate a version 4 (random) UUID
const generateSecretAccessToken = () => {
    return uuid.v4();
};
const secretAccessToken = generateSecretAccessToken();

const generateUserId = () => {
    return uuid.v4();
};

const userID = generateUserId();

// Create connection to the MySQL database
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

// Registering a user
router.post('/register', (req, res) => {
    const { name, email, password } = req.body;

    const saltRounds = 10;

    const sqlEmail = "SELECT * from users WHERE email = ?;"

    //Checking if the email already exists in the database
    db.query(sqlEmail, [email], (err, results) => {
        if (err) {
            console.error('Could not validate email, please try again' + err);
            return res.status(500).send('Could not validate email, please try again');
        } else if(results.length > 0) {
            return res.status(400).send("Email already exists");
        }
        
    })

    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
            console.error("Error hashing password: " + err);
            return res.status(500).send("Registration failed");
        } else {
            const sql = "INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?);";
            const values = [userID, email, hash, name];

            db.query(sql, values, (err) => {
                if (err) {
                    console.error('Error registering user: ' + err);
                    return res.status(500).send("Registration failed");
                } else {
                    return res.status(200).send("Registration successful");
                }
            })
        }
    })
})

// Authenticate, log the user in and generate JWT token
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    const sql = 'SELECT * FROM users WHERE email = ?';

    db.query(sql, [email], (err, results) => {
        if (err) {
          console.error('Could not validate email: ' + err);
          return res.status(500).send('Could not validate email, please try again');
        }

        if (results.length === 0) {
            return res.status(401).send('Email not found');
        }

        const nameUser = results[0].name;
        const hashedPassword = results[0].password;
        const userId = results[0].userID;

        bcrypt.compare(password, hashedPassword, (compareErr, isPasswordMatch) => {
        if (compareErr) {
            console.error('Error comparing passwords: ' + compareErr);
            return res.status(500).send('Authentication failed');
        }

        if (!isPasswordMatch) {
            return res.status(401).send('Invalid password'); // Incorrect password
        }

        // Password is correct, create and send a JWT token
        const accessToken = jwt.sign({ email: email }, secretAccessToken, { expiresIn: '3h' });

        res.status(200).json({userId, accessToken, nameUser, email})
        });
    })
})

module.exports = router;