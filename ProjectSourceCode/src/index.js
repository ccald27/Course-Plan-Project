// ----------------------------------   DEPENDENCIES  ----------------------------------------------
const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs'); // Added bcrypt for password hashing
const { error } = require('console');
app.use(express.static(__dirname + ''));

app.use(express.urlencoded({ extended: true }));

app.use('/resources', express.static(path.join(__dirname, 'resources')));

// -------------------------------------  APP CONFIG   ----------------------------------------------

// Create an instance of ExpressHandlebars and configure the layouts and partials directories.
const hbs = handlebars.create({
  extname: 'hbs',
  defaultLayout: 'main', // ensures that views are rendered within views/layouts/main.hbs

  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));



// Middleware for parsing JSON and URL-encoded data
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// Set up session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: true,
    resave: true,
  })
);

// -------------------------------------  DB CONFIG AND CONNECT   ---------------------------------------
const dbConfig = {
  host: process.env.POSTGRES_HOST || 'db',
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};
const db = pgp(dbConfig);

// Test the database connection
db.connect()
  .then(obj => {
    console.log('Database connection successful');
    obj.done(); // release the connection;
  })
  .catch(error => {
    console.log('ERROR', error.message || error);
  });

// -------------------------------------  ROUTES   ----------------------------------------------

//welcome route for testing
app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

// Render the registration page
app.get('/register', (req, res) => {
  res.render('pages/register');
});
app.get('/', (req, res) => {
  res.render('pages/home');
});

// Handle user registration
// Register API (Add User) /add-user is the register


app.post('/register', async (req, res) => {
  try {
    const { first_name, last_name, identikey, password, isAdvisor } = req.body;
    if (!first_name || !last_name || !password || !identikey) {
      return res.status(400).render('pages/register', { message: 'All fields are required', error: true });
    }
    // Validate identikey format: 4 letters followed by 4 digits
    const identikeyRegex = /^[a-zA-Z]{4}\d{4}$/;
    if (!identikeyRegex.test(identikey)) {
      return res.status(400).json({ message: 'Invalid identikey format' });
      //return res.status(400).render('pages/register', { message: 'Invalid identikey format', error: true });
    }

    const studentOrAdvisor = isAdvisor == 'on' ? 'advisors' : 'students';

    await db.oneOrNone(`SELECT * FROM ${studentOrAdvisor} WHERE identikey = '${identikey}'`)
      .then(async (existingUser) => {
        if (existingUser) {
          return res.status(400).render('pages/register', { message: 'User already exists', error: true });
        }


        // Hash the password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        let insertUserQuery = `INSERT INTO ${studentOrAdvisor} (first_name, last_name, password, identikey) VALUES ('${first_name}', '${last_name}', '${hashedPassword}', '${identikey}');`;

        //if student registering, make their start term Fall 2025 by default. Otherwise search and add class will not work
        //Student schedule mapping and search is based off of student's start term
        if (studentOrAdvisor == 'students') {
          insertUserQuery += `UPDATE students SET start_term='fa25' WHERE identikey = '${identikey}'`
        }
        db.any(insertUserQuery)
          .then(() => {
           return res.status(200).json({message: 'Success'});
          })
      });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//-----------Login Route--------------

app.get('/login', (req, res) => {
  res.render('pages/login');
});

app.get('/test', (req, res) => {
  return res.redirect(302, '/login');
})


// Handle user login

app.post('/login', async (req, res) => {
  let user = null;
  const { identikey, password } = req.body;
  try {
    if (!identikey || !password) {
      return res.status(400).render('pages/login', { message: 'All fields are required', error: true });
    }
    //check if advisor or student
    const advisor = await db.oneOrNone(`SELECT * FROM advisors WHERE identikey = '${identikey}'`)
    const student = await db.oneOrNone(`SELECT * FROM students WHERE identikey = '${identikey}'`)

    if (!advisor && !student) {
      return res.status(400).render('pages/login', { message: 'User does not exist', error: true });

    }
    let a_or_s = null;
    if (advisor) {
      a_or_s = 'advisors';
    }
    if (student) {
      a_or_s = 'students';
    }
    //check if password is correct
    const userpass = await db.oneOrNone(`SELECT password FROM ${a_or_s} WHERE identikey = $1`, [identikey]);
    const match = await bcrypt.compare(password, userpass?.password || '');

    if (match) {
      let user;

      if (advisor == null) {
        // Student user
        user = {
          identikey: student.identikey,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
          year: student.year,
          start_term: "fa25",
          advisor_notes: student.advisor_notes,
          advisor_id: student.advisor_id,
          student_courses: student.student_courses,
          isAdvisor: false
        };
      } else {
        // Advisor user
        user = {
          identikey: advisor.identikey,
          first_name: advisor.first_name,
          last_name: advisor.last_name,
          email: advisor.email,
          student_ids: advisor.student_ids,
          isAdvisor: true
        };
      }

      req.session.user = user;
      req.session.save();
    } else {
      return res.status(401).render('pages/login', {
        message: 'Incorrect password.',
        error: true
      });
    }

    // Redirect to the appropriate page based on user type
    if (a_or_s === 'advisors') {
      //console.log("going to advisor page");
      res.redirect('/scheduleAdvisor');
    } else {
      //redirect to student schedule
      res.redirect('/schedule');
    }
  }

  catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }


});

// Authentication Middleware.
const auth = (req, res, next) => {
  if (!req.session.user) {
    // Default to login page.
    return res.redirect('/login');
  }
  next();
};

// Authentication Required
app.use(auth);

//----------Add class to student classes----------
app.post('/addStudentClass', async (req, res) => {
  const { course_id } = req.body;
  const identikey = req.session.user.identikey;
  const cDB = await db.oneOrNone(`SELECT * FROM courses WHERE course_id = '${course_id}'`);

  await db.none(`INSERT INTO student_courses (identikey, course_id, course_name, credit_hours, term, taken) VALUES ('${identikey}', '${cDB.course_id}', '${cDB.course_name}', ${cDB.credit_hours}, '${cDB.term}', true)`)
    .then(() => {
      res.redirect('/schedule');

    });

})


//----------Advisor get students----------


//----------Class Search Route ---------
app.post('/getClasses', async (req, res) => {
  try {
    const { keyword, currentButtonId, semesterToQuery } = req.body;
    // console.log(req.body);
    let term = semesterToQuery;
    //keep student courses handy and update them
    let student_courses = await db.any(`SELECT * FROM student_courses WHERE identikey = '${req.session.user.identikey}'`)
    // Get courses from database
    await db.any(`SELECT * FROM courses WHERE (term = '${term}') AND ((course_id ILIKE '%${keyword}%') OR (course_name ILIKE '%${keyword}%')) `)
      .then((courses) => {
        const takenCourseIds = student_courses.map(sc => sc.course_id);
        courses.forEach(course => {
          course.taken = takenCourseIds.includes(course.course_id);
        });
        console.log("Rendering with these courses:", courses);
        res.render('pages/schedule', {
          courses: courses,
          user: req.session.user,
          keyword,
          currentButtonId,
          semesterToQuery,
          student_courses: JSON.stringify(student_courses)
        })


      });
  }
  catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});



//-----------Logout Route--------------
app.get('/logout', (req, res) => {
  res.render('pages/logout')
  user = null;
  req.session.destroy();
});



//----------Schedule page Routes--------------
// app.get('/schedule', (req, res) => {
//   res.render('pages/schedule')
// });


////RUN docker and TEST NEW SCHEDULE THING/////////




const router = express.Router();
// const pool = require('../index');


app.get('/schedule', async (req, res) => {
  try {
    const isUserCourses = await db.query(`SELECT * FROM students WHERE identikey = '${req.session.user.identikey}'`)
    if(isUserCourses.student_courses == undefined) {
      return res.status(404).json({message: 'Student Courses Not Found'})
    }
    const identikey = req.session.user.identikey;
    const updatedStudent = await db.oneOrNone(`SELECT * FROM students WHERE identikey = $1`, [identikey]);

    if (!updatedStudent) {
      return res.status(404).send('Student not found');
    }

    req.session.user = {
      identikey: updatedStudent.identikey,
      first_name: updatedStudent.first_name,
      last_name: updatedStudent.last_name,
      email: updatedStudent.email,
      year: updatedStudent.year,
      start_term: updatedStudent.start_term,
      advisor_notes: updatedStudent.advisor_notes,
      advisor_id: updatedStudent.advisor_id,
      student_courses: updatedStudent.student_courses,
      isAdvisor: false
    };

    let student_courses = await db.any(`SELECT * FROM student_courses WHERE identikey = $1`, [identikey]);

    res.render('pages/schedule', {
      user: req.session.user,
      courses: null,
      student_courses: JSON.stringify(student_courses)
    });

  } catch (err) {
    console.error('Error retrieving schedule:', err);
    res.status(500).send('Server Error');
  }
});


//-----------Advisor Register After Route--------------

// Advisor Schedule Page (pulling from student_courses field in students table)
// Advisor Schedule Page (display courses from student_ids array)
app.get('/scheduleAdvisor', async (req, res) => {
  try {
    const studentRows = await db.any('SELECT * FROM students');
    const students = {};

    for (const student of studentRows) {
      const scheduledCourses = {};

      const studentCourses = await db.any(
        `SELECT * FROM student_courses WHERE identikey = $1`,
        [student.identikey]
      );

      for (const course of studentCourses) {
        const term = course.term || 'fa25'; // default if missing
        if (!scheduledCourses[term]) {
          scheduledCourses[term] = [];
        }
        scheduledCourses[term].push({
          course_id: course.course_id,
          course_name: course.course_name,
          credit_hours: course.credit_hours,
          term: course.term
        });
      }

      students[student.identikey] = {
        identikey: student.identikey,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        year: student.year,
        start_term: student.start_term || 'fa25',
        advisor_notes: student.advisor_notes || '',
        scheduledCourses
      };
    }

    const defaultStudentKey = Object.keys(students)[0];

    res.render('pages/scheduleAdvisor', {
      user: req.session.user,
      real_students: JSON.stringify(students),
      defaultStudentKey
    });

  } catch (err) {
    console.error('Error loading advisor schedule:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/save-notes', async (req, res) => {
  const { identikey, notes } = req.body;

  try {
    await db.none(
      `UPDATE students SET advisor_notes = $1 WHERE identikey = $2`,
      [notes, identikey]
    );

    if (
      req.session.user &&
      req.session.user.identikey === identikey &&
      !req.session.user.isAdvisor
    ) {
      req.session.user.advisor_notes = notes;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving notes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



////profile//////////
// Authentication Required

///////////////

app.get('/fetchStudentData', async (req, res) => {
  console.log("no");
});



// Update a course’s term when it’s dragged into a new semester
app.post('/student_courses/updateTerm', async (req, res) => {
  const { identikey, course_id, term } = req.body;
  try {
    await db.none(
      `UPDATE student_courses
         SET term = $1
       WHERE identikey = $2
         AND course_id = $3`,
      [term, identikey, course_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating term:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


////remove class route:


app.post('/removeStudentClass', async (req, res, next) => {
  try {

    const course_id = req.body.course_id;
    if (!course_id) {
      console.error('No course_id in form!');
      return res.status(400).send('Missing course_id');
    }
    const identikey = req.session?.user?.identikey;
    if (!identikey) {
      console.error('No user in session!');
      return res.redirect('/login');  // or whatever makes sense
    }

    const result = await db.result(
      `DELETE FROM student_courses
         WHERE identikey = $1
           AND course_id = $2`,
      [identikey, course_id]
    );

    return res.redirect('/schedule');
  } catch (err) {
    next(err);
  }
});

// -------------------------------------  START SERVER   ----------------------------------------------

// Start the server on port 3000
const server = app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});

module.exports = {server, db}