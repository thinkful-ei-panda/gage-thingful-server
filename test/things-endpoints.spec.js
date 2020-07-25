const knex = require('knex');
const app = require('../src/app');
const helpers = require('./test-helpers');
const supertest = require('supertest');

describe('Things Endpoints', function() {
  let db;

  const {
    testUsers,
    testThings,
    testReviews,
  } = helpers.makeThingsFixtures();

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    });
    app.set('db', db);
  });

  after('disconnect from db', () => db.destroy());

  before('cleanup', () => helpers.cleanTables(db));

  afterEach('cleanup', () => helpers.cleanTables(db));

  describe('Protected endpoints', () => {
    beforeEach('insert articles', () => 
      helpers.seedThingsTables(
        db,
        testUsers,
        testThings,
        testReviews
      )
    );
    describe('GET /api/things/:things_id',()=>{
      it('responds with 401 \'Missing basic token\' when no basic token', () => {
        return supertest(app)
          .get('/api/things/1')
          .expect(401, {error : 'Missing basic token'});
      } );

    });
  });


  describe('GET /api/things', () => {
    context('Given no things', () => {
      it('responds with 200 and an empty list', () => {
        return supertest(app)
          .get('/api/things')
          .expect(200, []);
      });
    });

    context('Given there are things in the database', () => {
      beforeEach('insert things', () =>
        helpers.seedThingsTables(
          db,
          testUsers,
          testThings,
          testReviews
        )
      );

      it('responds with 200 and all of the things', () => {
        const expectedThings = testThings.map(thing =>
          helpers.makeExpectedThing(
            testUsers,
            thing,
            testReviews
          )
        );
        return supertest(app)
          .get('/api/things')
          .expect(200, expectedThings);
      });
    });

    context('Given an XSS attack thing', () => {
      const testUser = helpers.makeUsersArray()[1];
      const {
        maliciousThing,
        expectedThing,
      } = helpers.makeMaliciousThing(testUser);

      beforeEach('insert malicious thing', () => {
        return helpers.seedMaliciousThing(
          db,
          testUser,
          maliciousThing
        );
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get('/api/things')
          .expect(200)
          .expect(res => {
            expect(res.body[0].title).to.eql(expectedThing.title);
            expect(res.body[0].content).to.eql(expectedThing.content);
          });
      });
    });
  });


  const protectedEndpoints = [
    {
      name : 'GET /api/things/:things_id',
      path : '/api/things/1'
    }
    ,
    {
      name : 'GET /api/things/:things_id/reviews',
      path : '/api/things/1/reviews'
    }
  ];
  protectedEndpoints.forEach(endpoint => {
    describe.only(endpoint.name, () => {

      context('Given no things', () => {
      
        beforeEach(()=>{
          db.into('thingful_users').insert(testUsers);
        });
        it('responds with 401 "missing basic token" when nothing is given', ()=>{
          return supertest(app)
            .get(endpoint.path)
            .expect(401, {error : 'Missing basic token'});
        });
        it('responds with 401 "Unauthorized request" when no credentials in token', ()=>{
          const userNoCred = {user_name : '', password: 'the man who knows this oz of words, has a ton to tell, but must remain unspoken '};
          return supertest(app)
            .get(endpoint.path)
            .set('Authorization', helpers.makeAuthHeader(userNoCred))
            .expect(401, {error : 'Unauthorized request'});
        });
        it('responds with 401 "Unauthorized request" when invalid user', () => {
          const userInvalidUser = {user_name : '6gf6d5g41hd' , password : 'w3e5r1gs'};
          return supertest(app)
            .get(endpoint.path)
            .set('Authorization', helpers.makeAuthHeader(userInvalidUser))
            .expect(401,{error : 'Unauthorized request'});
        });
        it('responds with 401 "Unauthorized request" when invalid password  ');
        const userInvalidPassword = {user_name : testUsers[0].user_name , password : 'g0hj6l8g4'};
        return supertest(app)
          .get(endpoint.path)
          .set('Authorization', helpers.makeAuthHeader(userInvalidPassword))
          .expect(401,{error : 'Unauthorized request'});
      });
    });

  

    context('Given there are things in the database', () => {
      beforeEach('insert things', () =>
        helpers.seedThingsTables(
          db,
          testUsers,
          testThings,
          testReviews
        )
      );

      it('responds with 200 and the specified thing', () => {
        const thingId = 2;
        const expectedThing = helpers.makeExpectedThing(
          testUsers,
          testThings[thingId - 1],
          testReviews
        );

        return supertest(app)
          .get(`/api/things/${thingId}`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .expect(200, expectedThing);
      });
    });

    context('Given an XSS attack thing', () => {
      const testUser = helpers.makeUsersArray()[1];
      const {
        maliciousThing,
        expectedThing,
      } = helpers.makeMaliciousThing(testUser);

      beforeEach('insert malicious thing', () => {
        return helpers.seedMaliciousThing(
          db,
          testUser,
          maliciousThing
        );
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/api/things/${maliciousThing.id}`)
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(200)
          .expect(res => {
            expect(res.body.title).to.eql(expectedThing.title);
            expect(res.body.content).to.eql(expectedThing.content);
          });
      });
    });
  });

  describe('GET /api/things/:thing_id/reviews', () => {
    context('Given no things', () => {
      it('responds with 404', () => {
        const thingId = 123456;
        return supertest(app)
          .get(`/api/things/${thingId}/reviews`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .expect(404, { error: 'Thing doesn\'t exist' });
      });
    });

    context('Given there are reviews for thing in the database', () => {
      beforeEach('insert things', () =>
        helpers.seedThingsTables(
          db,
          testUsers,
          testThings,
          testReviews
        )
      );

      it('responds with 200 and the specified reviews', () => {
        const thingId = 1;
        const expectedReviews = helpers.makeExpectedThingReviews(
          testUsers, thingId, testReviews
        );

        return supertest(app)
          .get(`/api/things/${thingId}/reviews`)
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .expect(200, expectedReviews);
      });
    });
  });
});
