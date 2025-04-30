// ********************** Initialize server **********************************

const {server, db} = require('../src/index'); //TODO: Make sure the path to your index.js is correctly added
const bcryptjs = require('bcryptjs');
// ********************** Import Libraries ***********************************

const chai = require('chai'); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;

// ********************** DEFAULT WELCOME TESTCASE ****************************

describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
});

// *********************** TODO: WRITE 2 UNIT TESTCASES **************************

//register tests
describe('Testing Register API', () => {
  it('positive : /register', done => {
    chai
      .request(server)
      .post('/register')
      .send({identikey: 'test1777', first_name: 'John', last_name: 'Doe', password: 'pass'})
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.message).to.equals('Success');
        done();
      });
  });

  it('Negative : /register. Checking invalid name', done => {
    chai
      .request(server)
      .post('/register')
      .send({identikey: 'UserName2000', first_name: 'John', last_name: 'Doe', password:'pass'})
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.message).to.equals('Invalid identikey format');
        done();
      });
  });
});


//redirect test
describe('Testing Redirect', () => {
  it('\test should redirect to /login with a 302 HTTP code', done => {
    chai
      .request(server)
      .get('/test')
      //login has a render so we need to stop the redirect (otherwise get a 200)
      .redirects(0)
      .end((err, res) => {
        res.should.have.status(302); // Expecting a redirect status code
        //just goes to /login instead of explicit 'localhost/login'
        res.should.redirectTo('/login'); // Expecting a redirect to /login (localhost not inc.)
        done();
      });
  });
});

//render test
describe('Testing Render', () => {
  it('test "/login" route should render with an html response', done => {
    chai
      .request(server)
      .get('/login') 
      .end((err, res) => {
        res.should.have.status(200); // Expecting a success status code
        res.should.be.html; // Expecting a HTML response
        done();
      });
  });
});

describe('Student Schedule Route Tests', () => {
  let agent;
  const testUser = {
    identikey: 'test1899',
    password: 'testpass123',
    first_name: 'john',
    last_name: 'doe'
  };

  before(async () => {
    // Clear users table and create test user
    await db.query('TRUNCATE TABLE students CASCADE');
    const hashedPassword = await bcryptjs.hash(testUser.password, 10);
    await db.query('INSERT INTO students (identikey, password, first_name, last_name) VALUES ($1, $2, $3, $4)', [
      testUser.identikey,
      hashedPassword,
      testUser.first_name,
      testUser.last_name
    ]);
  });

  beforeEach(() => {
    // Create new agent for session handling
    agent = chai.request.agent(server);
  });

  afterEach(() => {
    // Clear cookie after each test
    agent.close();
  });

  after(async () => {
    // Clean up database
    await db.query('TRUNCATE TABLE students CASCADE');
  });

  describe('GET /schedules', () => {
    it('should return user info before logged in at schedules', done => {
      chai
        .request(server)
        .get('/schedule')
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('object');
          done();
        });
    });

    it('should return 404 if user has no courses', async () => {
      // First login to get session
      await agent.post('/login').send(testUser);

      // Then access profile
      const res = await agent.get('/schedule');

      expect(res).to.have.status(404);
      expect(res.body.message).to.equals('Student Courses Not Found');

    });
  });
});


// ********************************************************************************