/**
Chirag Gupta
Budget Planner
*/

// Paycheck.js
// Keeps record of user income/paychecks.

const mongoose = require('mongoose');

const paycheckSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true            // paycheck is tied to a specific user
  },
  amount: { 
    type: Number, 
    required: true, 
    min: 0              // cannot be negative
  },
  description: { 
    type: String, 
    default: 'Paycheck' // default label if nothing is provided
  },
  date: { 
    type: Date, 
    default: Date.now   // automatically stores current date and time
  }
});

// export model
module.exports = mongoose.model('Paycheck', paycheckSchema);
