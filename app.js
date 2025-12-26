const PDFDocument = require('pdfkit');
const express = require('express');
const mongoose = require('mongoose'); // ADD THIS
const app = express();
const path = require('path');

// The Bridge
const mongoURI = "mongodb+srv://admin:Mohan0354@cluster0.xxx.mongodb.net/attendanceDB";
mongoose.connect(mongoURI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ Connection Error:", err));

// The User Schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    approved: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

// ... existing User model code at Line 20
const User = mongoose.model('User', userSchema); 


// --- ADD EMAIL SETTINGS HERE (Line 21) ---
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'mohaneesh799@gmail.com', // Your developer email
        pass: 'parmvjyxydebguzj'     // Generated from Google Account Security
    }
});
// ------------------------------------------

app.set('view engine', 'ejs'); // This is currently your Line 22


app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));


const DB_FILE = './database.json';

// Function to Load Data from JSON
function loadData() {
    if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    }
    // Default initial data if file doesn't exist yet
    return {
        students: [
            { id: 1, name: "Student Alpha", attendance: 90, status: "Present" },
            { id: 2, name: "Student Beta", attendance: 85, status: "Present" }
        ],
        users: [
            { email: "admin@gmail.com", role: "Master", approved: true },
            { email: "teacher@gmail.com", role: "Lecturer", approved: false },
            { email: "leader@college.edu", role: "Leader", approved: false }
        ]
    };
}

// Function to Save Data to JSON
function saveData() {
    const dataToSave = { students: studentsList, users: users };
    fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2));
}

// Initialize variables from the file
let db = loadData();
let studentsList = db.students;
let users = db.users;

// --- ROUTES ---

// Login Page
app.get('/', (req, res) => res.render('login'));



app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Search for the user in MongoDB
        const user = await User.findOne({ email, password });

        if (user && user.approved) {
            // If approved, send them to their dashboard
            res.redirect(`/${user.role.toLowerCase()}`);
        } else if (user && !user.approved) {
            // If they exist but you haven't clicked 'Approve' in your email yet
            res.send("Your account is pending approval from the developer.");
        } else {
            // If the email or password doesn't match
            res.send("Invalid credentials.");
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});


app.post('/approve-user', (req, res) => {
    const { userEmail } = req.body;
    const user = users.find(u => u.email === userEmail);
    if (user) {
        user.approved = true;
        saveData(); // <--- Add this line here
        console.log(`Master approved: ${user.email}`);
    }
    // ... rest of your existing code
});


app.post('/submit-attendance', (req, res) => {
    const { subject, leaderEmail } = req.body; 
    
    const doc = new PDFDocument();
    const fileName = `Attendance_${subject.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    const stream = fs.createWriteStream(fileName);
    
    doc.pipe(stream);

    // PDF Content
    doc.fontSize(22).text('College Attendance Report', { align: 'center' });
    doc.fontSize(14).text(`Subject: ${subject}`, { align: 'center' });
    doc.text(`Recorded by Leader: ${leaderEmail}`, { align: 'center' });
    doc.text(`Date: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown().text('--------------------------------------------------').moveDown();

 // Inside app.post('/submit-attendance'...)
studentsList.forEach(student => {
    // 1. Get status from the leader's form
    const status = req.body[`status_${student.id}`] || "Absent"; 
    
    // 2. UPDATE the global list so the Teacher and Student see it!
    student.status = status; 

    // ... (rest of your PDF logic follows)
});
    doc.end();

    stream.on('finish', () => {
        const nodemailer = require('nodemailer');
        
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'mohaneesh799@gmail.com', // Your authenticated Gmail
                pass: 'parmvjyxydebguzj'         // Your 16-digit App Password
            }
        });

        const mailOptions = {
            from: `"Attendance System (${leaderEmail})" <mohaneesh799@gmail.com>`,
            // ADDING BOTH RECIPIENTS HERE:
            to: 'admin@gmail.com, teacher@gmail.com', 
            subject: `New Attendance Report: ${subject}`,
            text: `The Leader (${leaderEmail}) has submitted the attendance for ${subject}. Please find the PDF attached.`,
            attachments: [{ filename: fileName, path: `./${fileName}` }]
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                res.send("Email failed to reach Master and Lecturer.");
            } else {
                res.send(`<h1>Success!</h1><p>Report sent to Master and Lecturer.</p><a href="/">Go Home</a>`);
            }
        });
    });
});




app.post('/edit-attendance', (req, res) => {
    const { studentId, newStatus } = req.body;
    const student = studentsList.find(s => s.id == studentId);
    if (student) {
        student.status = newStatus;
        saveData(); // <--- This saves the attendance change permanently
        console.log(`Updated ${student.name} to ${newStatus}`);
    }
    res.redirect('/lecturer');
});

// Add this so the redirect actually has a page to go to
app.get('/lecturer', (req, res) => {
    res.render('lecturer', { 
        user: users.find(u => u.role === "Lecturer"), 
        students: studentsList 
    });
});




app.post('/register', async (req, res) => {
    const { email, password, role } = req.body;
    try {
        const newUser = new User({
            email,
            password,
            role,
            approved: false // Starts as unapproved
        });
        await newUser.save();

        // Send Email to you (The Developer)
        const approvalLink = `https://attendance-app-jjtx.onrender.com/approve-master/${newUser._id}`;
        
        await transporter.sendMail({
            from: 'your-email@gmail.com',
            to: 'your-email@gmail.com', // Send to yourself
            subject: 'New Master Registration Request',
            html: `<p>User <b>${email}</b> wants to be a Master.</p>
                   <a href="${approvalLink}">Click here to Approve this Master</a>`
        });

        res.send("Registration request sent! Please wait for developer approval.");
    } catch (err) {
        res.status(500).send("Error: " + err.message);
    }
});






const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
});



app.get('/approve-master/:id', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { approved: true });
        res.send("✅ Master account has been successfully approved and assigned!");
    } catch (err) {
        res.status(500).send("Approval failed.");
    }
});