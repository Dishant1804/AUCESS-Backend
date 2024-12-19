import express from 'express';
import { PrismaClient } from '@prisma/client';
import authMiddleware from './middleware/authMiddleware.js'
import authenticate from './middleware/authenticate.js';

const prisma = new PrismaClient();
const router = express.Router();

/**
 * @desc Create a new quiz
 * @route POST /api/v1/quiz/create-quiz
 * @access Private (Admin only)
 */
router.post('/create-quiz', authenticate(['ADMIN']), async (req, res) => {
  const { title, description, price, questions } = req.body;
  const adminId = req.user.id;

  try {
    if (!title || !description || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        message: 'Please provide title, description, and at least one question'
      });
    }

    const quiz = await prisma.quiz.create({
      data: {
        title,
        description,
        price,
        adminId,
        questions: {
          create: questions.map(question => ({
            text: question.text,
            correctAnswer: question.correctAnswer,
            options: {
              create: question.options.map(option => ({
                text: option.text
              }))
            }
          }))
        }
      },

      include: {
        questions: {
          include: {
            options: true
          }
        }
      }
    });

    await prisma.leaderBoard.create({
      data: {
        quizId: quiz.id
      }
    });

    res.status(201).json({
      success: true,
      data: quiz
    });
  } 
  catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ success: false, message: 'Error creating quiz'});
  }
});

export default router;
