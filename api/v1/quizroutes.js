import express from 'express';
import { PrismaClient } from '@prisma/client';
import passport from './config/passportConfig.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * add middle ware and fix the ids 
 * error handling is not proper
 * the score updates only when the user clicks the submit button
 */

// Middleware for authentication (remove this trash)
const authenticate = passport.authenticate('jwt', { session: false });

// Get all available contests
router.get('/contests', authenticate, async (req, res) => {
  try {
    const contests = await prisma.contest.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        fee: true,
        maxUsers: true,
        timeLimit: true,
        _count: {
          select: { users: true }
        }
      }
    });
    res.json(contests);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contests" });
  }
});

// Get specific contest details
router.get('/contests/:id', authenticate, async (req, res) => {
  try {
    const contest = await prisma.contest.findUnique({
      where: { id: req.params.id },
      include: {
        questions: {
          include: {
            options: true
          }
        }
      }
    });
    if (!contest) return res.status(404).json({ error: "Contest not found" });
    res.json(contest);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contest" });
  }
});

// Join a contest
router.post('/contests/:id/join', authenticate, async (req, res) => {
  try {
    const contest = await prisma.contest.update({
      where: { id: req.params.id },
      data: {
        users: {
          connect: { id: req.user.id }
        }
      }
    });
    res.json({ message: "Successfully joined contest" });
  } catch (error) {
    res.status(500).json({ error: "Failed to join contest" });
  }
});

// Submit answers and calculate points
router.post('/contests/:id/submit', authenticate, async (req, res) => {
  try {
    const { answers } = req.body; // answers = [{questionId, optionId}]
    const contest = await prisma.contest.findUnique({
      where: { id: req.params.id },
      include: { questions: true }
    });

    let points = 0;
    for (const answer of answers) {
      const question = await prisma.question.findUnique({
        where: { id: answer.questionId }
      });
      if (question.correctOptionId === answer.optionId) {
        points += 1;
      }
    }

    const contestPoints = await prisma.contestPoints.create({
      data: {
        userId: req.user.id,
        contestId: req.params.id,
        points
      }
    });

    res.json({ points: contestPoints.points });
  } catch (error) {
    res.status(500).json({ error: "Failed to submit answers" });
  }
});

// Get contest results
router.get('/contests/:id/results', authenticate, async (req, res) => {
  try {
    const results = await prisma.contestPoints.findMany({
      where: { contestId: req.params.id },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        points: 'desc'
      }
    });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

export default router;