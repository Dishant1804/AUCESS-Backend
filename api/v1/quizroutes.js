import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

/**
 * @desc Get all quizzes
 * @route GET /api/quizzes
 */
router.get('/', async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      include: {
        admin: true,
        questions: true,
      },
    });
    res.json(quizzes);
  }
  catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @desc Get a single quiz by ID
 * @route GET /api/quizzes/:id
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        admin: true,
        questions: true,
      },
    });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    res.json(quiz);
  }
  catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @desc Get all quiz joined by user
 * @route POST /api/quizzes
 */
router.get('/users/:id/quizzes', async (req, res) => {
  const { id } = req.params; // userId
  try {
    const userQuizzes = await prisma.userQuiz.findMany({
      where: { userId: id },
      include: {
        quiz: {
          include: { admin: true, questions: true },
        },
      },
    });
    res.json(userQuizzes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @desc Get all users in a particular quiz
 * @route GET /api/:id/users
 */
router.get('/:id/users', async (req, res) => {
  const { id } = req.params; // quizId
  try {
    const users = await prisma.userQuiz.findMany({
      where: { quizId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    res.json(users.map((entry) => entry.user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @desc Create a new quiz
 * @route POST /api/quizzes
 */
router.post('/', async (req, res) => {
  const { title, description, adminId } = req.body;
  try {
    const quiz = await prisma.quiz.create({
      data: {
        title,
        description,
        adminId,
      },
    });
    res.status(201).json(quiz);
  }
  catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @desc Update an existing quiz
 * @route PUT /api/quizzes/:id
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  try {
    const updatedQuiz = await prisma.quiz.update({
      where: { id },
      data: { title, description },
    });
    res.json(updatedQuiz);
  }
  catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @desc Delete a quiz
 * @route DELETE /api/quizzes/:id
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.quiz.delete({
      where: { id },
    });
    res.json({ message: 'Quiz deleted successfully' });
  }

  catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @desc Get questions for a quiz
 * @route GET /api/quizzes/:id/questions
 */
router.get('/:id/questions', async (req, res) => {
  const { id } = req.params;
  try {
    const questions = await prisma.question.findMany({
      where: { quizId: id },
    });
    res.json(questions);
  }
  catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @desc Join a quiz
 * @route POST /api/quizzes/:id/join
 */
router.post('/:id/join', async (req, res) => {
  const { id } = req.params; // quizId
  const { userId } = req.body;
  try {
    const userQuiz = await prisma.userQuiz.create({
      data: {
        quizId: id,
        userId,
      },
    });
    res.status(201).json(userQuiz);
  }
  catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @desc Get leaderboard for a quiz
 * @route GET /api/quizzes/:id/leaderboard
 */
router.get('/:id/leaderboard', async (req, res) => {
  const { id } = req.params;
  try {
    const leaderboard = await prisma.leaderBoard.findUnique({
      where: { quizId: id },
      include: {
        entries: {
          include: {
            user: true,
          },
        },
      },
    });
    if (!leaderboard) return res.status(404).json({ message: 'Leaderboard not found' });
    res.json(leaderboard);
  }
  catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
