import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { hash, compare } from "bcrypt";
import { PrismaClient } from '@prisma/client';

dotenv.config();

const JWT_SECRET_KEY = process.env.JWT_SECRET;
const SALT_ROUNDS = 12;
const prisma = new PrismaClient();

const router = express.Router();

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET_KEY, { expiresIn: '1h' });
};

// Middleware to verify JWT and roles
const authenticate = (roles) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET_KEY, (err, decoded) => {
      if (err) return res.status(403).json({ message: 'Invalid token' });

      if (!roles.includes(decoded.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      req.user = decoded;
      next();
    });
  };
};

// Signup Route
router.post('/signup', async (req, res) => {
  const { email, name, password, role } = req.body;

  try {
    const hashedPassword = await hash(password, SALT_ROUNDS);

    let user;
    if (role === 'ADMIN') {
      user = await prisma.admin.create({
        data: {
          email,
          name,
          password: hashedPassword
        }
      });
    }
    else if (role === 'SUB_ADMIN') {
      return res.status(400).json({ message: 'Sub-admins must be created by an admin' });
    }
    else {
      user = await prisma.user.create({
        data: { 
          email, 
          name, 
          password: hashedPassword 
        }
      });
    }

    const token = generateToken(user);
    res.status(201).json({ message: 'Signup successful', token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } }) ||
      await prisma.admin.findUnique({ where: { email } }) ||
      await prisma.subAdmin.findUnique({ where: { email } });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = generateToken(user);
    res.status(200).json({ message: 'Login successful', token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create Sub-Admin (Admin-only)
/**
 * There is an error here
 */
router.post('/create-sub-admin', authenticate(['ADMIN']), async (req, res) => {
  const { email, name, password } = req.body;
  const adminId = req.user.id;

  try {
    const hashedPassword = await hash(password, SALT_ROUNDS);

    const subAdmin = await prisma.subAdmin.create({
      data: {
        email,
        name,
        password: hashedPassword,
        adminId
      }
    });

    res.status(201).json({ message: 'Sub-admin created successfully', subAdmin });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Protected Route Example (Role-specific access)
router.get('/dashboard', authenticate(['USER', 'ADMIN', 'SUB_ADMIN']), (req, res) => {
  res.status(200).json({ message: `Welcome ${req.user.role}`, user: req.user });
});

// Delete User (Admin-only)
router.delete('/delete-user/:id', authenticate(['ADMIN']), async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.delete({ where: { id } });
    res.status(200).json({ message: 'User deleted successfully', user });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
