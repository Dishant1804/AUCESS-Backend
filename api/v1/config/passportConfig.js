import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';

dotenv.config();

const googleClientID = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const backendURL = process.env.BACKEND_URL;

if (!googleClientID || !googleClientSecret || !backendURL) {
  console.error('Missing required environment variables for Google OAuth');
  console.error(`GOOGLE_CLIENT_ID: ${googleClientID ? 'Available' : 'Missing'}`);
  console.error(`GOOGLE_CLIENT_SECRET: ${googleClientSecret ? 'Available' : 'Missing'}`);
  console.error(`BACKEND_URL: ${backendURL ? 'Available' : 'Missing'}`);
}

passport.use('google-dashboard', new GoogleStrategy({
  clientID: googleClientID,
  clientSecret: googleClientSecret,
  callbackURL: `${backendURL}/api/v1/auth/google/dashboard/callback`,
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