DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS advisors;

CREATE TABLE students (
  identikey VARCHAR(20) PRIMARY KEY NOT NULL,
  password VARCHAR(60) NOT NULL,
 first_name  VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(200),
  year VARCHAR(15),
  start_term VARCHAR(20),
  advisor_id VARCHAR(20),
  advisor_notes VARCHAR(200),
  student_courses VARCHAR(50)[],
  number_of_semesters NUMERIC

);
CREATE TABLE advisors (
  identikey VARCHAR(20) PRIMARY KEY NOT NULL,
  password VARCHAR(60) NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(200),
  --array of students per advisor
  student_ids VARCHAR(20)[]
);

--This is the code for student courses


DROP TABLE IF EXISTS advisor_notes;
CREATE TABLE advisor_notes (
  id SERIAL PRIMARY KEY,
  student_identikey VARCHAR(20) REFERENCES students(identikey),
  advisor_identikey VARCHAR(20) REFERENCES advisors(identikey),
  note_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--This is the code for student courses


--This code will insert sample data into the tables `advisors`, `students_to_advisors`, `courses`, `student_courses`, and `prerequisites`. You can modify the values in the `INSERT INTO` statements to match your specific data.
DROP TABLE IF EXISTS students_to_advisors;
CREATE TABLE students_to_advisors (
  student_id VARCHAR(20) NOT NULL REFERENCES students (identikey),
  advisor_id VARCHAR(20) NOT NULL REFERENCES advisors (identikey)
);

DROP TABLE IF EXISTS courses;
CREATE TABLE courses (
  course_id VARCHAR(20) PRIMARY KEY,
  course_name VARCHAR(100) NOT NULL,
  credit_hours NUMERIC NOT NULL,
  term VARCHAR(20) NOT NULL,
  prerequisites VARCHAR(50)[]

);

DROP TABLE IF EXISTS student_courses;
CREATE TABLE student_courses (
  identikey VARCHAR(20) NOT NULL,
  course_id VARCHAR(20) NOT NULL,
  course_name VARCHAR(50) NOT NULL,
  credit_hours NUMERIC NOT NULL,
  term VARCHAR(20) NOT NULL,
  taken BOOLEAN DEFAULT false
);

DROP TABLE IF EXISTS users;
CREATE TABLE users (
  username VARCHAR(50) PRIMARY KEY,
  password VARCHAR(60) NOT NULL,
  first_name VARCHAR(60),
  last_name VARCHAR(60)
)




