const express = require('express')
const mysql = require('mysql2')

const router = express.Router();

// Create connection to the MySQL database
const db = mysql.createConnection({
    multipleStatements: true,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

router.get('/users', async (req, res) => {
    const conversationId = req.query.conversationId;
    const friendId = req.query.friendId

    try {
        const sql = 'SELECT * FROM users WHERE userID = ?;SELECT * FROM messages WHERE conversationID = ? ORDER BY creation_datetime DESC LIMIT 1;';
        const values = [friendId, conversationId];
        
        db.query(sql, values, (err, results) => {
            if (err) {
                console.error('Error fetching users:', err);
                return res.status(500).json({ error: 'Failed to fetch users' });
            }

            const userData =  results[0].map(result => {
                return {
                    name: result.name,
                    userId: result.userID
                }
            })

            const conversationData =  results[1].map(result => {
                return {
                    conversationId: result.conversationID,
                    createdAt: result.creation_datetime,
                    message: result.message,
                    senderId: result.sender_id
                }
            })
            console.log(userData, conversationData)

            return res.status(200).json({userData, conversationData});
        })
    } catch (err) {
        res.status(500).json(err);
    }
});

// Fetch all other users profiles except the current user
router.get('/all_users/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        const sql = 'SELECT * from users WHERE userID != ? LIMIT 15';
        const values = [userId];
        
        db.query(sql, values, (err, results) => {
            if (err) {
                console.error('Error fetching users:', err);
                return res.status(500).json({ error: 'Failed to fetch users' });
            }

            const users = results.map(user => {
                return {
                    id: user.userID,
                    name: user.name
                }
            })

            return res.status(200).json({ users });
        })
    } catch (err) {
        res.status(500).json(err);
    }
});

// Get the first 10 users based on the search input value of a new chat
router.post('/new_conv_users', async (req, res) => {
    const { sender, friendName } = req.body;

    try {
        const sql = 'SELECT * from users WHERE userID != ? AND name = ? LIMIT 10';
        const values = [sender, friendName];
        
        db.query(sql, values, (err, results) => {
            if (err) {
                console.error('Error fetching users:', err);
                return res.status(500).json({ error: 'Failed to fetch users' });
            }

            const users = results.map(user => {
                return {
                    id: user.userID,
                    name: user.name,
                    email: user.email
                }
            })

            return res.status(200).json({ users });
        })
    } catch (err) {
        res.status(500).json(err);
    }
});

module.exports = router;