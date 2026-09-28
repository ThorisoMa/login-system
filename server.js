require('dotenv').config();

const path = require('path');
const express = require('express');
const bcrypt = require('bcrypt');
const passport = require('passport');
const flash = require('express-flash');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const methodOverride = require('method-override');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const {
  pool,
  initDb,
  findUserByEmail,
  findUserById,
  createUser,
  closeDb,
} = require('./db');
const initializePassport = require('./passport-config');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required. Add it to your .env file.');
}

if (isProduction) {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);

app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProduction ? '1d' : 0 }));
app.use(methodOverride('_method'));
app.use(flash());
app.use(
  session({
    store: new pgSession({
      pool,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

initializePassport(passport, findUserByEmail, findUserById);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many authentication attempts. Please try again later.',
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many registration attempts. Please try again later.',
});

app.get('/', checkAuthenticated, (req, res) => {
  res.render('home', { name: req.user.name });
});

app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login');
});

app.post(
  '/login',
  checkNotAuthenticated,
  authLimiter,
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true,
  })
);

app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('register');
});

app.post('/register', checkNotAuthenticated, registrationLimiter, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (name.length < 2 || name.length > 100) {
    req.flash('error', 'Name must be between 2 and 100 characters.');
    return res.redirect('/register');
  }

  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) {
    req.flash('error', 'Please enter a valid email address.');
    return res.redirect('/register');
  }

  if (password.length < 8 || password.length > 72) {
    req.flash('error', 'Password must be between 8 and 72 characters.');
    return res.redirect('/register');
  }

  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      req.flash('error', 'An account with that email already exists.');
      return res.redirect('/register');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await createUser({ name, email, password: hashedPassword });

    req.flash('success', 'Account created successfully. Please sign in.');
    return res.redirect('/login');
  } catch (error) {
    if (error.code === '23505') {
      req.flash('error', 'An account with that email already exists.');
      return res.redirect('/register');
    }

    console.error('Registration error:', error);
    req.flash('error', 'Unable to create your account right now.');
    return res.redirect('/register');
  }
});

app.delete('/logout', checkAuthenticated, (req, res, next) => {
  req.logout((error) => {
    if (error) return next(error);

    req.session.destroy((sessionError) => {
      if (sessionError) return next(sessionError);
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  });
});

app.use((req, res) => {
  res.status(404).render('error', { title: 'Page not found', message: 'The page you requested could not be found.' });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).render('error', { title: 'Something went wrong', message: 'An unexpected error occurred.' });
});

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return res.redirect('/');
  next();
}

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

process.on('SIGTERM', async () => {
  await closeDb();
  process.exit(0);
});

module.exports = app;
