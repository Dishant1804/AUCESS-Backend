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
 * @tested True
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
    res.status(500).json({ success: false, message: 'Error creating quiz' });
  }
});

/**
 * @desc Get all quizzes with user count
 * @route GET /api/v1/quiz/quizzes
 * @access Public 
 * @tested True
 */
router.get('/quizzes', authMiddleware, async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      include: {
        _count: {
          select: {
            attempts: true
          }
        },
        questions: {
          select: {
            id: true
          }
        },
        leaderboard: {
          include: {
            _count: {
              select: {
                entries: true
              }
            }
          }
        }
      }
    });


    const formattedQuizzes = quizzes.map(quiz => ({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      price: quiz.price,
      totalQuestions: quiz.questions.length,
      totalParticipants: quiz._count.attempts,
      leaderboardEntries: quiz.leaderboard?._count.entries ?? 0,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt
    }));

    res.status(200).json({
      success: true,
      data: formattedQuizzes
    });
  }
  catch (error) {
    console.error('Error getting all quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting quizzes',
      error: error.message
    });
  }
});

/**
 * @desc Get single quiz by ID
 * @route GET /api/v1/quiz/:quizId
 * @access Public
 * @tested True
 */
router.get('/:quizId', authMiddleware, async (req, res) => {
  const { quizId } = req.params;

  try {
    const quiz = await prisma.quiz.findUnique({
      where: {
        id: quizId
      },
      include: {
        questions: {
          include: {
            options: true
          }
        },
        _count: {
          select: {
            attempts: true
          }
        },
        leaderboard: {
          include: {
            _count: {
              select: {
                entries: true
              }
            },
            entries: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              },
              orderBy: {
                score: 'desc'
              },
              take: 10
            }
          }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    const formattedQuiz = {
      ...quiz,
      totalParticipants: quiz._count.attempts,
      totalQuestions: quiz.questions.length,
      leaderboardEntries: quiz.leaderboard?._count.entries ?? 0,
      topScores: quiz.leaderboard?.entries ?? []
    };

    delete formattedQuiz._count;

    res.status(200).json({
      success: true,
      data: formattedQuiz
    });
  }
  catch (error) {
    console.error('Error getting quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting quiz',
      error: error.message
    });
  }
});

/**
 * @desc Update quiz (partial update)
 * @route PATCH /api/v1/quiz/:quizId
 * @access Private (Admin only)
 * @tested True
 */
router.patch('/:quizId', authenticate(['ADMIN']), async (req, res) => {
  const { quizId } = req.params;
  const adminId = req.user.id;
  const updates = req.body;

  try {
    const existingQuiz = await prisma.quiz.findFirst({
      where: {
        id: quizId,
        adminId
      }
    });

    if (!existingQuiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or you do not have permission to update it'
      });
    }

    const updatedQuiz = await prisma.$transaction(async (prisma) => {
      let quiz = existingQuiz;

      if (updates.title || updates.description || updates.price !== undefined) {
        quiz = await prisma.quiz.update({
          where: { id: quizId },
          data: {
            ...(updates.title && { title: updates.title }),
            ...(updates.description && { description: updates.description }),
            ...(updates.price !== undefined && { price: updates.price })
          }
        });
      }

      if (updates.questions) {
        if (updates.operation === 'replace') {

          await prisma.question.deleteMany({
            where: { quizId }
          });

          await prisma.quiz.update({
            where: { id: quizId },
            data: {
              questions: {
                create: updates.questions.map(question => ({
                  text: question.text,
                  correctAnswer: question.correctAnswer,
                  options: {
                    create: question.options.map(option => ({
                      text: option.text
                    }))
                  }
                }))
              }
            }
          });
        }
        else if (updates.operation === 'add') {

          await prisma.quiz.update({
            where: { id: quizId },
            data: {
              questions: {
                create: updates.questions.map(question => ({
                  text: question.text,
                  correctAnswer: question.correctAnswer,
                  options: {
                    create: question.options.map(option => ({
                      text: option.text
                    }))
                  }
                }))
              }
            }
          });
        }
      }

      return prisma.quiz.findUnique({
        where: { id: quizId },
        include: {
          questions: {
            include: {
              options: true
            }
          }
        }
      });
    });

    res.status(200).json({
      success: true,
      data: updatedQuiz
    });
  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating quiz',
      error: error.message
    });
  }
});

/**
 * @desc Delete quiz
 * @route DELETE /api/v1/quiz/:quizId
 * @access Private (Admin only)
 * @tested False
 */
router.delete('/:quizId', authenticate(['ADMIN']), async (req, res) => {
  const { quizId } = req.params;
  const adminId = req.user.id;

  try {

    const quiz = await prisma.quiz.findFirst({
      where: {
        id: quizId,
        adminId
      }
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or you do not have permission to delete it'
      });
    }

    await prisma.quiz.delete({
      where: {
        id: quizId
      }
    });

    res.status(200).json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  }
  catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting quiz',
      error: error.message
    });
  }
});

/**
 * @desc Join a quiz
 * @route POST /api/v1/quiz/:quizId/join
 * @access Public
 */
router.post('/:quizId/join', authMiddleware, async (req, res) => {
  const { quizId } = req.params;
  const userId = req.user.id;

  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId }
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    const existingAttempt = await prisma.quizAttempt.findUnique({
      where: {
        userId_quizId: {
          userId,
          quizId
        }
      }
    });

    if (existingAttempt) {
      return res.status(400).json({
        success: false,
        message: 'You have already joined this quiz'
      });
    }

    const quizAttempt = await prisma.quizAttempt.create({
      data: {
        userId,
        quizId,
        score: 0,
        completed: false
      },
      include: {
        quiz: {
          select: {
            title: true,
            description: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Successfully joined the quiz',
      data: quizAttempt
    });
  } catch (error) {
    console.error('Error joining quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Error joining quiz',
      error: error.message
    });
  }
});

/**
 * @desc Get all users in a particular quiz
 * @route GET /api/v1/quiz/:quizId/users
 * @access Private (Admin only)
 */
router.get('/:quizId/users', authenticate(['ADMIN']), async (req, res) => {
  const { quizId } = req.params;

  try {
    const users = await prisma.quizAttempt.findMany({
      where: {
        quizId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } 
  catch (error) {
    console.error('Error getting quiz users:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting quiz users',
      error: error.message
    });
  }
});

/**
 * @desc Get all quizzes joined by a user
 * @route GET /api/v1/quiz/user/joined
 * @access Private
 */
router.get('/user/joined', authenticate(['USER']), async (req, res) => {
  const userId = req.user.id;

  try {
    const joinedQuizzes = await prisma.quizAttempt.findMany({
      where: {
        userId
      },
      include: {
        quiz: {
          include: {
            _count: {
              select: {
                questions: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedQuizzes = joinedQuizzes.map(attempt => ({
      attemptId: attempt.id,
      quizId: attempt.quiz.id,
      title: attempt.quiz.title,
      description: attempt.quiz.description,
      score: attempt.score,
      completed: attempt.completed,
      totalQuestions: attempt.quiz._count.questions,
      joinedAt: attempt.createdAt
    }));

    res.status(200).json({
      success: true,
      count: formattedQuizzes.length,
      data: formattedQuizzes
    });
  } catch (error) {
    console.error('Error getting joined quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting joined quizzes',
      error: error.message
    });
  }
});

/**
 * @desc Get quiz leaderboard
 * @route GET /api/v1/quiz/:quizId/leaderboard
 * @access Public
 */
router.get('/:quizId/leaderboard', authMiddleware, async (req, res) => {
  const { quizId } = req.params;
  const { limit = 10, page = 1 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  try {
    const leaderboardEntries = await prisma.leaderBoardEntry.findMany({
      where: {
        leaderboard: {
          quizId
        }
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        score: 'desc'
      },
      take: parseInt(limit),
      skip: skip
    });

    const totalEntries = await prisma.leaderBoardEntry.count({
      where: {
        leaderboard: {
          quizId
        }
      }
    });

    const formattedEntries = leaderboardEntries.map((entry, index) => ({
      rank: skip + index + 1,
      score: entry.score,
      userName: entry.user.name,
      userEmail: entry.user.email,
      createdAt: entry.createdAt
    }));

    res.status(200).json({
      success: true,
      data: {
        entries: formattedEntries,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalEntries / parseInt(limit)),
          totalEntries,
          entriesPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting leaderboard',
      error: error.message
    });
  }
});

export default router;