/* eslint-disable no-useless-escape */
const REGEX_UPPER_LOWER_NUMBER_SPECIAL = /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&])[\S]+/;

const xss = require('xss');
const bcrypt = require('bcryptjs');

const UserService ={
  hasUserWithUserName(db, user_name){
    return db('thingful_users')
      .where({user_name})
      .first()
      .then(user => !!user);
  },
  insertUser(db,newUser){
    return db   
      .insert(newUser)
      .into('thingful_users')
      .returning('*')
      .then( ([user]) => user);
  },
  serializeUser(user){
    return{
      id : user.id,
      user_name: xss(user.user_name), 
      nickname: xss(user.nickname), 
      full_name : xss(user.full_name), 
      date_created : new Date(user.date_created)
    };
  },
  hashPassword(password){
    return bcrypt.hash(password, 12);
  },
  validatePassword(password){
    if(password.length < 8){
      return 'Password must be at less 8 characters long';
    }
    if(password.length > 72){
      return 'Password must be shorter then 72 characters long';
    }
    if(password.startsWith(' ')|| password.endsWith(' ')){
      return 'Password must not start or end with spaces';
    }
    if(!REGEX_UPPER_LOWER_NUMBER_SPECIAL.test(password)){
      return 'Password must contain 1 upper case Letter, 1 number, and 1 special character';
    }
  }
};

module.exports = UserService; 