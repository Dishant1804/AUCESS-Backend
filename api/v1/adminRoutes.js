import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { hash, compare } from "bcryptjs";
import { PrismaClient } from '@prisma/client';
import authenticate from './middleware/authenticate.js';

dotenv.config();

const JWT_SECRET_KEY = process.env.JWT_SECRET;
const SALT_ROUNDS = 12;
const prisma = new PrismaClient();
const router = express.Router();

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET_KEY,
    { expiresIn: "30d" }
  );
};

// Protected Route Example (Admin + Sub-admin)
router.get('/dashboard', authenticate(['ADMIN', 'SUB_ADMIN']), (req, res) => {
  return res.status(200).json({
    message: `Welcome Admin ${req.user.role}`,
    user: req.user
  });
});

// Admin Signup Route
router.post('/signup', async (req, res) => {
  const { email, name, password } = req.body;

  try {
    const hashedPassword = await hash(password, SALT_ROUNDS);

    const admin = await prisma.admin.create({
      data: {
        email,
        name,
        password: hashedPassword,
      }
    });

    admin.role = 'ADMIN'; // You can also persist this to DB if needed

    const token = generateToken(admin);
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax'
    });

    return res.status(201).json({ message: 'Admin signup successful', success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error', success: false });
  }
});

// Admin Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin)
      return res.status(404).json({ message: 'Admin not found', success: false });

    const isMatch = await compare(password, admin.password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid credentials', success: false });

    admin.role = 'ADMIN';

    const token = generateToken(admin);
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

//Subadmin Login Route
router.post('/subadmin/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const subadmin = await prisma.subAdmin.findUnique({ where: { email } });

    if (!subadmin)
      return res.status(404).json({ message: 'Subadmin not found', success: false });

    const isMatch = await compare(password, subadmin.password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid credentials', success: false });

    subadmin.role = 'SUB_ADMIN';

    const token = generateToken(subadmin);
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

// Create Sub-Admin (Admin-only)
router.post('/create-sub-admin', authenticate(['ADMIN']), async (req, res) => {
  const { email, name, password } = req.body;
  const adminId = req.user.id;

  try {
    const hashedPassword = await hash(password, SALT_ROUNDS);

    await prisma.subAdmin.create({
      data: {
        email,
        name,
        password: hashedPassword,
        adminId
      }
    });

    return res.status(201).json({ message: 'Sub-admin created successfully', success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error', success: false });
  }
});

// Delete User (Admin-only)
router.delete('/delete-user/:id', authenticate(['ADMIN', 'SUB_ADMIN']), async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.quizAttempt.deleteMany({
      where: {
        userId: id
      }
    });
    await prisma.leaderBoardEntry.deleteMany({
      where: {
        userId : id
      }
    })
    const user = await prisma.user.delete({
      where: {
        id
      }
    });

    return res.status(200).json({ message: 'User deleted successfully', user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error', success: false });
  }
});

// Get Sub-Admins (Admin-only)
router.get('/sub-admins', authenticate(['ADMIN']), async (req, res) => {
  const adminId = req.user.id;

  try {
    // Get only sub-admins created by the logged-in admin
    const subAdmins = await prisma.subAdmin.findMany({
      where: {
        adminId
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        password: true
      }
    });

    return res.status(200).json({ 
      message: 'Sub-admins fetched successfully', 
      subAdmins,
      success: true 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error', success: false });
  }
});

// Delete Sub-Admin (Admin-only)
router.delete('/sub-admin/:id', authenticate(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.id;

  try {
    // First check if the sub-admin belongs to the logged-in admin
    const subAdmin = await prisma.subAdmin.findFirst({
      where: {
        id,
        adminId
      }
    });

    if (!subAdmin) {
      return res.status(404).json({ 
        message: 'Sub-admin not found or you do not have permission to delete', 
        success: false 
      });
    }

    // Delete the sub-admin
    await prisma.subAdmin.delete({
      where: {
        id
      }
    });

    return res.status(200).json({ 
      message: 'Sub-admin deleted successfully', 
      success: true 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error', success: false });
  }
});

export default router;
