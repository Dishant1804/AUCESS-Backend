import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

passport.use('google-dashboard' , new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.BACKEND_URL}/api/v1/auth/google/dashboard/callback`,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const data = { profile };
    done(null, data);
  }
  catch (error) {
    done(error, null);
  }
}));

export default passport;