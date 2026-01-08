/**
Chirag Gupta
Budget Planner
*/

// Expense.js
// This schema keeps track of each expense the user adds.

const mongoose = require('mongoose');

// define what an expense document should look like
const expenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // each expense belongs to a specific user
  },
  title: { 
    type: String, 
    required: true // every expense must have a title
  },
  amount: { 
    type: Number, 
    required: true, 
    min: 0 // no negative values allowed
  },
  category: { 
    type: String, 
    default: 'Other' // if no category is chosen
  },
  date: { 
    type: String, 
    required: true // date is stored as string
  },
  createdAt: { 
    type: Date, 
    default: Date.now // automatic timestamp when expense is created
  }
});

// export this model so we can use it in server.js
module.exports = mongoose.model('Expense', expenseSchema);
