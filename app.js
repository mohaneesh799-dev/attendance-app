const fs = require('fs'); // Fixed: Added fs back
const PDFDocument = require('pdfkit');
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();

// --- The Bridge (MongoDB Connection) ---
// IMPORTANT: Ensure you have added 0.0.0.0/0 in MongoDB Atlas Network Access!
const mongoURI = "mongodb+srv://admin:Mohan0354@cluster0.0jkiiez.mongodb.net/attendanceDB"; 

mongoose.connect(mongoURI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ Connection error:', err));

// --- The User Schema ---
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    approved: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema); // Fixed: Only one declaration here

// --- Middleware ---
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// --- Nodemailer Setup ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'mohaneesh799@gmail.com',
        pass: 'pxmxjpylyshdsjrf' // Your 16-character App Password
    }
});

// --- GET ROUTES (To show pages) ---

app.get('/', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => { // Fixed: This stops the "Cannot GET /register" error
    res.render('register');
});

app.get('/master', (req, res) => res.render('master'));
app.get('/student', (req, res) => res.render('student'));
app.get('/lecturer', (req, res) => res.render('lecturer'));

// --- POST ROUTES (To handle forms) ---

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email, password });
        if (user) {
            if (user.approved) {
                res.redirect(`/${user.role.toLowerCase()}`);
            } else {
                res.send("Your account is pending approval from the developer.");
            }
        } else {
            res.send("Invalid email or password.");
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error"); // This shows if DB connection fails
    }
});

app.post('/register', async (req, res) => {
    const { email, password, role } = req.body;
    try {
        const newUser = new User({ email, password, role, approved: false });
        await newUser.save();

        const approvalLink = `https://attendance-app-jjtx.onrender.com/approve-user/${newUser._id}`;

        await transporter.sendMail({
            from: 'mohaneesh799@gmail.com',
            to: 'mohaneesh799@gmail.com',
            subject: 'New User Registration Request',
            html: `<p>User <b>${email}</b> wants to be a ${role}.</p>
                   <a href="${approvalLink}">Click here to Approve</a>`
        });

        res.send("Registration request sent! Please wait for approval.");
    } catch (err) {
        res.status(500).send("Error: " + err.message);
    }
});

app.get('/approve-user/:id', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { approved: true });
        res.send("User approved successfully!");
    } catch (err) {
        res.status(500).send("Approval failed.");
    }
});

// --- Server Startup ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
});