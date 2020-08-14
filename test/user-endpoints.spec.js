/*eslint-disable quotes*/
const knex = require('knex');
const app = require('../src/app');
const helpers = require('./test-helpers');
const bcrypt = require('bcryptjs');
const supertest = require('supertest');
const { expect } = require('chai');

describe.only('Users Endpoint', () =>{

  let db;

  const { testUsers } = helpers.makeThingsFixtures();
  const testUser = testUsers[0];

  before('make knex instance', () => {
    db = knex({
      client : 'pg',
      connection : process.env.TEST_DB_URL,
    });
    app.set('db',db);
  });

  after('disconnect from db', () => db.destroy());

  before('clean up', () => helpers.cleanTables(db));

  afterEach('clean up', () => helpers.cleanTables(db));

  describe('POST /api/users', () => {
    context('User Validation', () =>{
      beforeEach('insert users', () => helpers.seedUsers(db, testUsers)); 
    
      const requiredFields = ['user_name', 'password', 'full_name'];

      requiredFields.forEach( field => {

        const requestAttemptBody = {
          user_name : 'test user_name',
          password : 'te5t p@ssWord',
          full_name : 'test full_name',
          nickname : 'test nickname',
        };

        it(`responds with 400 request error when '${field}' is missing `, () => {
          delete requestAttemptBody[field];

          console.log(requestAttemptBody);

          return supertest(app)
            .post('/api/users')
            .send(requestAttemptBody)
            .expect(400, {error : `Missing '${field}' in request body`});
        });
      });
      it(`responds with 400 'Password must be longer then 8 characters' when password is short `,() => {
        const userShortPassword ={
          user_name : 'test user_name',
          password : '1234567',
          full_name : 'test full_name',
        };

        return supertest(app)
          .post('/api/users')
          .send(userShortPassword)
          .expect(400, {error : 'Password must be at less 8 characters long'});
      });
      it(`responds with 400 'Password must be shorter then 72 characters' when password is to big `,() => {
        const userPasswordLong ={
          user_name : 'test user_name',
          password : '*'.repeat(73),
          full_name : 'test full_name',
        };

        return supertest(app)
          .post('/api/users')
          .send(userPasswordLong)
          .expect(400, {error : 'Password must be shorter then 72 characters long'});
      });
      it(`responds with 400 when password starts with spaces`,() => {
        const userPasswordStartSpaces ={
          user_name : 'test user_name',
          password : ' wXDw[3/Y',
          full_name : 'test full_name',
        };

        return supertest(app)
          .post('/api/users')
          .send(userPasswordStartSpaces)
          .expect(400, {error : 'Password must not start or end with spaces'});
      });
      it(`responds with 400 when password ends with spaces`,() => {
        const userPasswordEndSpaces ={
          user_name : 'test user_name',
          password : 'wXDw[3/Y ',
          full_name : 'test full_name',
        };

        return supertest(app)
          .post('/api/users')
          .send(userPasswordEndSpaces)
          .expect(400, {error : 'Password must not start or end with spaces'});
      });
      it(`responds with 400 when password is not divers enough`,() => {
        const userPasswordSimple ={
          user_name : 'test user_name',
          password : '11AAaabb',
          full_name : 'test full_name',
        };

        return supertest(app)
          .post('/api/users')
          .send(userPasswordSimple)
          .expect(400, {error : 'Password must contain 1 upper case Letter, 1 number, and 1 special character'});
      });
      it(`responds with 400 when user_name is already taken`,() => {
        const takenUserName ={
          user_name : testUser.user_name,
          password : '11AAaa!!',
          full_name : 'test full_name',
        };

        return supertest(app)
          .post('/api/users')
          .send(takenUserName)
          .expect(400, {error : 'User name is already taken'});
      });

    });
    context('happy path', () => {
      it('responds with 201, and a serialized user, with bctped password', ()=>{
        const newUser ={
          user_name : 'test user_name',
          password : 'aaAA11!!',
          full_name : 'test full_name',
        };
        return supertest(app)
          .post('/api/users')
          .send(newUser)
          .expect(201)
          .expect( res => {
            expect(res.body).to.have.property('id');
            expect(res.body.user_name).to.equal(newUser.user_name);
            expect(res.body.full_name).to.equal(newUser.full_name);
            expect(res.body.nickname).to.equal('');
            expect(res.body).to.not.have.property('password');
            expect(res.header.location).to.eql(`/api/users/${res.body.id}`);
            const expectedDate = new Date().toLocaleString();
            const actualDate = new Date(res.body.date_created).toLocaleString();
            expect(actualDate).to.eql(expectedDate);
          })
          .expect(res => 
            db  
              .from('thingful_users')
              .select('*')
              .where({id: res.body.id})
              .first()
              .then(row => {
                expect(row.user_name).to.eql(newUser.user_name);
                expect(row.full_name).to.eql(newUser.full_name);
                expect(row.nickname).to.eql(null);
                const expectedDate = new Date().toLocaleString();
                const actualDate = new Date(res.body.date_created).toLocaleString();
                expect(actualDate).to.eql(expectedDate);

                return bcrypt.compare(newUser.password, row.password);
              })
              .then(comparePassword => expect(comparePassword).to.be.true)
          );


      });
    });
  });
});