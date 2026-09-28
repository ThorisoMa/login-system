const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

function initialize(passport, getUserByEmail, getUserById) {
  const authenticateUser = async (email, password, done) => {
    try {
      const user = await getUserByEmail(email.trim().toLowerCase());

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return done(null, false, { message: 'Invalid email or password.' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  };

  passport.use(
    new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, authenticateUser)
  );

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await getUserById(id);
      done(null, user || false);
    } catch (error) {
      done(error);
    }
  });
}

module.exports = initialize;
