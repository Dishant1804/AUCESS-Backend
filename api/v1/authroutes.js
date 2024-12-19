import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { hash, compare } from "bcrypt";
import { PrismaClient } from '@prisma/client';
import passport from "./config/passportConfig.js";
import authenticate from './middleware/authenticate.js';

dotenv.config();

const JWT_SECRET_KEY = process.env.JWT_SECRET;
const SALT_ROUNDS = 12;
const prisma = new PrismaClient();

const router = express.Router();

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET_KEY, { expiresIn: '15d' });
}

// User Signup Route
router.post('/signup', async (req, res) => {
  const { email, name, password } = req.body;

  try {
    const hashedPassword = await hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: 'USER'
      }
    });

    const token = generateToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax'
    });

    return res.status(201).json({ message: 'Signup successful', success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error', success: false });
  }
});

// User Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) return res.status(404).json({ message: 'User not found', success: false });

    const isMatch = await compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials', success: false });

    const token = generateToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax'
    });

    return res.status(200).json({ message: 'Login successful', success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error', success: false });
  }
});

router.get(
  "/google/dashboard",
  passport.authenticate("google-dashboard", {
    scope: ["profile", "email"],
  }),
);

router.get('/google/dashboard/callback', passport.authenticate('google-dashboard', {
  session: false,
  failureRedirect: "/login",
}),
  async (req, res) => {
    try {
      const { profile } = req.user;

      const user = await prisma.user.upsert({
        where: {
          email: profile.emails[0].value,
        },
        create: {
          name: profile.displayName,
          email: profile.emails[0].value,
          password: "google"
        },
        update: {
          name: profile.displayName
        }
      });

      const token = generateToken(user);

      res.cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
      });
      //res.redirect()
      res.send("user created");
    }
    catch (e) {
      console.log(e);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Protected Route Example (User)
router.get('/dashboard', authenticate(['USER']), (req, res) => {
  return res.status(200).json({ message: `Welcome ${req.user.role}`, user: req.user });
});

// Update Profile Route
router.put('/profile', authenticate(['USER']), async (req, res) => {
  const { name, password } = req.body;
  const userId = req.user.id;

  try {
    const updatedData = {};
    if (name) updatedData.name = name;
    if (password) updatedData.password = await hash(password, SALT_ROUNDS);

    const updatedUser = await prisma.user.update({
      where: {
        id: userId
      },
      data: updatedData
    });

    return res.status(200).json({ message: 'Profile updated successfully', success: true, user: updatedUser });
  }
  catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error', success: false });
  }
});

// Display Profile Details Route
router.get('/profile', authenticate(['USER']), async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true }
    });

    if (!user) return res.status(404).json({ message: 'User not found', success: false });

    return res.status(200).json({ user, success: true });
  }
  catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error', success: false });
  }
});

// Logout Route
router.post('/logout', authenticate(['USER']), (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax'
  });

  return res.status(200).json({ message: 'Logged out successfully', success: true });
});

export default router;
