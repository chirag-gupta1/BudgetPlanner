/**
Chirag Gupta
Budget Planner
*/

// User.js
// This handles user accounts, password hashing, and login validation.

const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // for encrypting passwords

// define user schema
const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,   // no duplicate usernames allowed
    trim: true      // remove spaces around username
  },
  password: { 
    type: String, 
    required: true 
  }
});

// before saving, hash the password
userSchema.pre('save', async function(next) {
  // only hash if password was modified or new
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);       // generate random salt
  this.password = await bcrypt.hash(this.password, salt); // hash it
  next();
});

// custom method to compare password when logging in
userSchema.methods.comparePassword = async function(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// export user model
module.exports = mongoose.model('User', userSchema);
