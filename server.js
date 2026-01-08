/**
 * Chirag Gupta
 * Budget Planner 
 */

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const connectMongo = require('connect-mongo');
require('dotenv').config();


// Handle both CommonJS and ESM style exports for connect-mongo
const MongoStore = connectMongo.default || connectMongo;

// Mongo Connection URI (must be defined before using in session store)
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_CLUSTER}/${process.env.MONGO_DB}?retryWrites=true&w=majority`;


// Models setup
const Expense = require('./models/Expense');
const Paycheck = require('./models/Paycheck');
const User = require('./models/User');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session settings
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create
    ? MongoStore.create({
        mongoUrl: uri,
        collectionName: 'sessions',
      })
    : new MongoStore({
        mongoUrl: uri,
        collection: 'sessions',
      }),
  cookie: {
    httpOnly: true,           // prevents JS access
    sameSite: "lax",          // protects against CSRF
    maxAge: 1000 * 60 * 60    // 1 hour
  }
}));

// Make session available to views
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Mongo Connection
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log("Connected to MongoDB");

  // Server-side validation
  try {
    const db = mongoose.connection.db;

    // Expense validation rules
    await db.command({
      collMod: "expenses",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["title", "amount", "category", "date"],
          properties: {
            title: { bsonType: "string", minLength: 1 },
            amount: { bsonType: "number", minimum: 0.01 },
            category: { bsonType: "string", minLength: 1 },
            date: { bsonType: "string" }
          }
        }
      }
    });

    // Paycheck validation rules
    await db.command({
      collMod: "paychecks",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["amount"],
          properties: {
            amount: { bsonType: "number", minimum: 0.01 },
            description: { bsonType: "string" }
          }
        }
      }
    });

  } catch (err) {
    console.log("Schema validation setup skipped");
  }

}).catch(err => {
  console.error("MongoDB connection error:", err);
});

// Login middleware
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

// ROUTES

// Register
app.get('/register', (req, res) => res.render('register', { error: null }));

app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    const existing = await User.findOne({ username });
    if (existing) return res.render('register', { error: 'Username already exists' });

    await User.create({ username, password });
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Registration failed' });
  }
});

// Login
app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user || !(await user.comparePassword(password))) {
      return res.render('login', { error: 'Invalid username or password' });
    }

    // Session Regeneration
    req.session.regenerate(err => {
      if (err) {
        console.error("Session regeneration error:", err);
        return res.render('login', { error: 'Login failed' });
      }

      req.session.userId = user._id;
      req.session.username = user.username;

      res.redirect('/');
    });

  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Login failed' });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Dashboard
// Home + Dashboard combined
app.get('/', async (req, res) => {
  try {
    //Not logged in → show marketing / landing page
    if (!req.session || !req.session.userId) {
      return res.render('home');     // <-- views/home.ejs (landing page)
    }

    //Logged in → show dashboard (your current logic)
    const { category } = req.query;

    const baseFilter = { userId: req.session.userId }; // scope to user
    const filter = category
      ? { ...baseFilter, category }
      : baseFilter;

    const expenses = await Expense.find(filter).sort({ date: -1 });
    const paychecks = await Paycheck
      .find({ userId: req.session.userId })
      .sort({ date: -1 });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalIncome  = paychecks.reduce((sum, p) => sum + p.amount, 0);
    const savings      = totalIncome - totalExpenses;

    let suggestion = '';
    if (totalIncome === 0)
      suggestion = 'Add your paychecks to track savings.';
    else if (savings > totalIncome * 0.2)
      suggestion = 'Great job! saving more than 20% of your income!';
    else if (savings >= 0)
      suggestion = 'You are on track, try to save a little more each month.';
    else
      suggestion = 'You are spending more than you earn. Try cutting costs.';

    // BUG FIX: your schema uses `userId`, not `user`
    const categories = await Expense.distinct('category', { userId: req.session.userId });

    res.render('index', {
      expenses,
      total: totalExpenses,
      totalIncome,
      savings,
      suggestion,
      categories,
      activeCategory: category || ''
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});



// Add expenses
app.get('/add', requireLogin, (req, res) =>
  res.render('add', { errors: [], form: {} })
);

app.post('/add', requireLogin, async (req, res) => {
  try {
    const { title, amount, category, date } = req.body;
    const errors = [];

    if (!title || title.trim() === '') errors.push('Title is required');
    if (!amount || Number(amount) <= 0) errors.push('Amount must be greater than 0');

    if (errors.length) return res.render('add', { errors, form: req.body });

    await Expense.create({
      userId: req.session.userId,                
      title: title.trim(),
      amount: Number(amount),
      category: category || 'Other',
      date: date || new Date().toISOString().slice(0, 10)
    });

    req.session.message = 'Expense added successfully!';
    res.redirect('/');

  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding expense');
  }
});


// Delete expenses
app.delete('/delete/:id', requireLogin, async (req, res) => {
  try {
    await Expense.deleteOne({
      _id: req.params.id,
      user: req.session.userId,      
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


// Paychecks
app.get('/paychecks', requireLogin, async (req, res) => {
  try {
    // 1️⃣ See everything in the collection (debug)
    const allPaychecks = await Paycheck.find().sort({ date: -1 });
    console.log('ALL paychecks in DB:', allPaychecks);

    // 2️⃣ Only this user’s paychecks
    const paychecks = await Paycheck
      .find({ userId: req.session.userId })       
      .sort({ date: -1 });

    console.log(
      'Filtered paychecks for userId',
      req.session.userId,
      'count:',
      paychecks.length
    );

    const totalPay = paychecks.reduce((sum, p) => sum + p.amount, 0);

    res.render('paychecks', { paychecks, totalPay });
  } catch (err) {
    console.error('Error loading paychecks:', err);
    res.status(500).send('Error');
  }
});


app.post('/paychecks', requireLogin, async (req, res) => {
  try {
    const { amount, description } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.redirect('/paychecks');
    }

    await Paycheck.create({
      userId: req.session.userId,              
      amount: Number(amount),
      description: description || 'Paycheck',
      date: new Date().toISOString().slice(0, 10),
    });

    res.redirect('/');                         

  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});


// Download text file
app.get('/download/txt', requireLogin, async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.session.userId }).sort({ date: -1 });


    let report = "Budget Planner\n";
    report += "-------------------------.\n\n";
    report += "Expense Report\n";
    report += "-------------------------.\n\n";

    expenses.forEach(e => {
      report += `Title: ${e.title}\n`;
      report += `Amount: $${e.amount}\n`;
      report += `Category: ${e.category}\n`;
      report += `Date: ${e.date}\n\n`;
    });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="expenses.txt"'
    );

    res.send(report);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating TXT file');
  }
});

// Error handling
app.use((req, res) =>
  res.status(404).render('404', { url: req.originalUrl })
);

app.use((err, req, res, next) => {
  console.error('Server Error:', err && err.message);
  res.status(500).render('500', { error: err });
});

// Starting server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server listening at http://localhost:${PORT}`)
);
