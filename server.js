const express = require('express')
const mysql = require('mysql2')
const cors = require('cors')
const bodyParser = require('body-parser')
const bcrypt = require('bcrypt')
const cookieParser = require('cookie-parser')
require('dotenv').config()
const { Server } = require('socket.io')
const http = require('http')
const userAuthRoutes = require('./routes/userAuth')
const messagesRoutes = require('./routes/messages')
const userRoutes = require('./routes/users');

//Server setup
const app = express()
const server = http.createServer(app);

//Middleware
app.use(cors())
app.use(express.json());
app.use(bodyParser.json());
app.use(cookieParser());

//Create connection between the client and server for Socket IO
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true,
    }
})

//Routes for registering and logging users in
app.use(userAuthRoutes);

//Routes for fetching users
app.use(userRoutes);

//Conversations and messages routes
app.use(messagesRoutes);

let users = [];

const addUser = (userId, socketId) => {
    !users.some(user => user.userId === userId) &&
        users.push({userId, socketId});
}

const removeUser = (socketId) => {
    users = users.filter(user => user.socketId !== socketId)
}

const getUser = (userId) => {
    return users.find(user => user.userId === userId)
}

//Socket IO functions
io.on('connection', socket => {
    console.log(socket.id)

    socket.on('addUser', userId => {
        addUser(userId, socket.id);
        io.emit('getUsers', users);
    })

    socket.on('chat-message', ({ userId, receiverId, message, createdAt, conversationId }) => {
        const receiverUser = getUser(receiverId)
        const senderUser = getUser(userId)
        console.log(receiverUser, senderUser)

        io.to(senderUser.socketId).emit('receive-message', {
            senderId: userId,
            message,
            createdAt,
            conversationId
        });

        if (receiverUser) {
            io.to(receiverUser.socketId).emit('receive-message', {
                senderId: userId,
                receiverId: receiverUser.userId,
                message,
                createdAt,
                conversationId
            });
        } else {
            console.log(`User with userId ${receiverId} not found.`);
        }


    })

    socket.on('disconnect', () => {
        console.log('User disconnected');
        removeUser(socket.id);
        io.emit('getUsers', users);
    })
})

//Creating Server
server.listen(8081, () => {
    console.log('server started...')
})