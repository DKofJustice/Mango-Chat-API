const express = require('express')
const mysql = require('mysql2')
const uuid = require('uuid');
const multer = require('multer');

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

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });


// Get all other users
router.get('/get-conversations/:userId', (req, res) => {
    const userId = req.params.userId

    const sql = 'SELECT * from conversations WHERE sender_id = ( ? ) OR receiver_id = ( ? )';
    const values = [userId, userId];

    db.query(sql, values, (err, results) => {
        if (err) {
            console.error('Error fetching conversations:', err);
            return res.status(500).json({ error: 'Failed to fetch conversations.' });
        }

        const conversations = results.map((conversation) => {
            return {
                id: conversation.conversationID,
                senderId: conversation.sender_id,
                receiverId: conversation.receiver_id,
            };
        });

        res.status(200).json({ conversations });
    });
});

// Create a new conversation
router.post('/new_conversation', (req, res) => {
    const { userId, friendId } = req.body;

    const generateConversationId = () => {
        return uuid.v4();
    };
    const conversationId = generateConversationId();
    let existingConversations;

    // Check if a conversation already exists
    const sqlValidate = 'SELECT * FROM conversations WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)'
    db.query(sqlValidate, [userId, friendId, friendId, userId], (err, results) => {
        if (err) {
            console.error('Error fetching conversations:', err);
            return res.status(500).json({ error: 'Failed to fetch conversations.' });
        }

        existingConversations = results.map((conversation) => {
            return {
                id: conversation.conversationID,
                senderId: conversation.sender_id,
                receiverId: conversation.receiver_id,
            };
        });

        if (existingConversations.length > 0) {
            return res.status(200).json({ conversations: existingConversations });
        }

        // Create a new conversation
        const sql = 'INSERT INTO conversations (sender_id, receiver_id, conversationID) VALUES (?, ?, ?)';
        const values = [userId, friendId, conversationId];

        db.query(sql, values, (createErr, createResults) => {
            if (createErr) {
                console.error('Error creating conversation:', createErr);
                return res.status(500).json({ error: 'Failed to create conversation' });
            }

            const conversations = createResults.map((conversation) => {
                return {
                    id: conversation.conversationID,
                    senderId: conversation.sender_id,
                    receiverId: conversation.receiver_id,
                };
            });

            res.status(200).json({ conversations });
        });
    });
});



//Get all conversation messages
router.get('/get_messages/:conversationId', (req, res) => {
    const conversationId = req.params.conversationId;

    const sql = 'SELECT * FROM messages WHERE conversationID = ? ORDER BY creation_datetime ASC';
    const values = [conversationId];

    db.query(sql, values, (err, results) => {
        if (err) {
            console.error('Error fetching messages:', err);
            return res.status(500).json({ error: 'Failed to fetch messages.' });
        }

        // Group messages by message ID
        const messages = results.reduce((accumulator, current) => {
            const messageId = current.id;
            if (!accumulator[messageId]) {
                accumulator[messageId] = {
                    id: messageId,
                    senderId: current.sender_id,
                    conversationId: current.conversationID,
                    createdAt: current.creation_datetime,
                    message: current.message,
                    images: []
                };
            }
            // If a file is associated with the message, add it to the images array
            if (current.filename && current.mimetype && current.data) {
                accumulator[messageId].images.push({
                    filename: current.filename,
                    mimetype: current.mimetype,
                    data: current.data
                });
            }
            return accumulator;
        }, {});

        // Convert the object of messages into an array
        const messageArray = Object.values(messages);

        res.status(200).json({ messages: messageArray });
    });
})

//Insert new message in the database
router.post('/send_messages', upload.array('files'), async (req, res) => {
    const { sender, text, conversationId } = req.body;
    const files = req.files;
    console.log(files)

    const generateMessageId = () => {
        return uuid.v4();
    };
    const messageId = generateMessageId();

    if (files && files.length > 0) {
        // Process and store each file
        await Promise.all(files.map(async (file) => {
            const { originalname, mimetype, size } = file;
            const newFile = {
                filename: originalname,
                mimetype: mimetype,
                size: size,
                data: file.buffer, // Use file.buffer instead of reading from disk
            };
            // Insert file data into the database
            db.query('INSERT INTO messages SET ?', newFile, (err) => {
                if (err) {
                  console.error('Error uploading file:', err);
                }
                res.send("Files inserted successfuly")
              });
        }));
    }

    const sql = 'INSERT INTO messages (id, sender_id, conversationID, message) VALUES (?, ?, ?, ?);SELECT * FROM messages WHERE conversationID = ? ORDER BY creation_datetime DESC LIMIT 1;';
    const values = [messageId, sender, conversationId, text, conversationId];

    db.query(sql, values, (err, results) => {
        if (err) {
            console.error('Error sending message:', err);
            return res.status(500).json({ error: 'Error sending message' });
        }

        res.status(200).json({results});
    });
})

module.exports = router;