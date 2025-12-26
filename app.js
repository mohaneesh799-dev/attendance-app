const PDFDocument = require('pdfkit');
const fs = require('fs');
const express = require('express');
const app = express();
const path = require('path');

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



app.post('/login', (req, res) => {
    const { email, role } = req.body;
    
    // 1. Find the user in your 'users' array (Line 15 in app.js)
    const user = users.find(u => u.email === email && u.role === role);

    // 2. CHECK: If user doesn't exist AND it's not a Student (since students aren't in the users array)
    if (!user && role !== "Student") {
        return res.send("User not found in system.");
    }

    // 3. RULE: Students and Leaders must use @college.edu (Line 35)
    if ((role === "Student" || role === "Leader") && !email.endsWith("@college.edu")) {
        return res.send("ACCESS DENIED: Please use your official College Email.");
    }

 if ((role === "Leader" || role === "Lecturer") && !user.approved) {
    return res.send("ACCESS DENIED: You have not been granted permission by the Master yet.");
}

    // 5. SUCCESS: Send to the correct dashboard
    if (role === "Student") {
        // We pass the global 'studentsList' so the student sees updated data
        res.render('student', { user: { email: email, role: role }, students: studentsList });
    } else {
        // Master, Lecturer, and Leader use their respective EJS files
        // We pass 'users' so the Master can see who needs approval
        res.render(role.toLowerCase(), { user: user, users: users, students: studentsList });
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












const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
});