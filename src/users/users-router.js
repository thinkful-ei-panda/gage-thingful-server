/* eslint-disable quotes */
const express = require('express');
const path = require('path');
const UserService = require('./users-service');

const userRouter = express.Router();

userRouter
  .post('/', express.json(), (req,res,next) =>{
    const {password, user_name, full_name, nickname } =req.body;

    for(const field of  ['full_name', 'user_name','password']){
      if(!req.body[field]){
        return res.status(400).json({error : `Missing '${field}' in request body`});
      }
    }

    const passwordError = UserService.validatePassword(password);

    if(passwordError){
      return res.status(400).json({error : passwordError});
    }

    UserService.hasUserWithUserName(
      req.app.get('db'),
      user_name
    )
      .then(hasUserWithUserName => {
        if(hasUserWithUserName){
          return res.status(400).json({error : 'User name is already taken'});
        }
        return UserService.hashPassword(password)
          .then(hashPassword =>{
            const newUser = {
              user_name ,
              password : hashPassword,
              full_name,
              nickname,
              date_created : 'now()'
            };
            return UserService.insertUser(req.app.get('db'), newUser)
              .then(user => {
                res.status(201)
                  .location(path.posix.join(req.originalUrl, `/${user.id}`))
                  .json(UserService.serializeUser(user));
              });
          });
      })
      .catch(next);
  });

module.exports = userRouter;