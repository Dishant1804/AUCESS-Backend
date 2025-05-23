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
  const { title, description, price, questions, startDate, endDate } = req.body;
  const adminId = req.user.id;

  try {
    if (!title || !description || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        message: 'Please provide title, description, and at least one question'
      });
    }

    // Parse dates if they're provided
    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;

    // Validate dates if both are provided
    if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
      return res.status(400).json({
        message: 'End date must be after start date'
      });
    }

    const quiz = await prisma.quiz.create({
      data: {
        title,
        description,
        price,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
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
    const currentDate = new Date();
    
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

    // Get total count of quizzes
    const totalQuizzes = quizzes.length;
    
    // Calculate total questions across all quizzes
    const totalQuestions = quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0);

    const formattedQuizzes = quizzes.map(quiz => {
      // Determine quiz status based on dates
      let status = 'upcoming';
      if (quiz.startDate && quiz.endDate) {
        if (currentDate < quiz.startDate) {
          status = 'upcoming';
        } else if (currentDate >= quiz.startDate && currentDate <= quiz.endDate) {
          status = 'ongoing';
        } else {
          status = 'completed';
        }
      } else if (quiz.startDate && !quiz.endDate) {
        status = currentDate >= quiz.startDate ? 'ongoing' : 'upcoming';
      } else if (!quiz.startDate && quiz.endDate) {
        status = currentDate <= quiz.endDate ? 'ongoing' : 'completed';
      }

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        price: quiz.price,
        startDate: quiz.startDate,
        endDate: quiz.endDate,
        status,
        totalQuestions: quiz.questions.length,
        totalParticipants: quiz._count.attempts,
        leaderboardEntries: quiz.leaderboard?._count.entries ?? 0,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt
      };
    });

    res.status(200).json({
      success: true,
      data: formattedQuizzes,
      count: totalQuizzes,
      summary: {
        totalQuizzes,
        totalQuestions
      }
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

// Route for upcoming quizzes
router.get('/upcoming', authMiddleware, async (req, res) => {
  try {
    const currentDate = new Date();
    
    const upcomingQuizzes = await prisma.quiz.findMany({
      where: {
        startDate: {
          gt: currentDate
        }
      },
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
        }
      }
    });

    const formattedQuizzes = upcomingQuizzes.map(quiz => ({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      price: quiz.price,
      startDate: quiz.startDate,
      endDate: quiz.endDate,
      totalQuestions: quiz.questions.length,
      totalParticipants: quiz._count.attempts,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt
    }));

    res.status(200).json({
      success: true,
      data: formattedQuizzes,
      count: upcomingQuizzes.length
    });
  }
  catch (error) {
    console.error('Error getting upcoming quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting upcoming quizzes',
      error: error.message
    });
  }
});

// Route for ongoing quizzes
router.get('/ongoing', authMiddleware, async (req, res) => {
  try {
    const currentDate = new Date();
    
    const ongoingQuizzes = await prisma.quiz.findMany({
      where: {
        OR: [
          {
            AND: [
              { startDate: { lte: currentDate } },
              { endDate: { gte: currentDate } }
            ]
          },
          {
            AND: [
              { startDate: { lte: currentDate } },
              { endDate: null }
            ]
          },
          {
            AND: [
              { startDate: null },
              { endDate: { gte: currentDate } }
            ]
          }
        ]
      },
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
        }
      }
    });

    const formattedQuizzes = ongoingQuizzes.map(quiz => ({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      price: quiz.price,
      startDate: quiz.startDate,
      endDate: quiz.endDate,
      totalQuestions: quiz.questions.length,
      totalParticipants: quiz._count.attempts,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt
    }));

    res.status(200).json({
      success: true,
      data: formattedQuizzes,
      count: ongoingQuizzes.length
    });
  }
  catch (error) {
    console.error('Error getting ongoing quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting ongoing quizzes',
      error: error.message
    });
  }
});

// Route for completed quizzes
router.get('/completed', authMiddleware, async (req, res) => {
  try {
    const currentDate = new Date();
    
    const completedQuizzes = await prisma.quiz.findMany({
      where: {
        endDate: {
          lt: currentDate
        }
      },
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

    const formattedQuizzes = completedQuizzes.map(quiz => ({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      price: quiz.price,
      startDate: quiz.startDate,
      endDate: quiz.endDate,
      totalQuestions: quiz.questions.length,
      totalParticipants: quiz._count.attempts,
      leaderboardEntries: quiz.leaderboard?._count.entries ?? 0,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt
    }));

    res.status(200).json({
      success: true,
      data: formattedQuizzes,
      count: completedQuizzes.length
    });
  }
  catch (error) {
    console.error('Error getting completed quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting completed quizzes',
      error: error.message
    });
  }
});

// Route for user's completed quizzes
router.get('/user/quizzes/completed', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find all quizzes where the user has completed attempts
    const completedQuizzes = await prisma.quizAttempt.findMany({
      where: {
        userId,
        completed: true
      },
      include: {
        quiz: {
          include: {
            questions: {
              select: {
                id: true
              }
            },
            leaderboard: {
              include: {
                entries: {
                  where: {
                    userId
                  }
                }
              }
            }
          }
        }
      }
    });

    const formattedQuizzes = completedQuizzes.map(attempt => {
      const quiz = attempt.quiz;
      const userLeaderboardEntry = quiz.leaderboard?.entries[0];
      
      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        yourScore: attempt.score,
        totalQuestions: quiz.questions.length,
        leaderboardRank: userLeaderboardEntry ? userLeaderboardEntry.score : null,
        attemptedAt: attempt.updatedAt,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt
      };
    });

    res.status(200).json({
      success: true,
      data: formattedQuizzes,
      count: completedQuizzes.length
    });
  }
  catch (error) {
    console.error('Error getting user completed quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting user completed quizzes',
      error: error.message
    });
  }
});

// Route for user's upcoming registered quizzes
router.get('/user/quizzes/upcoming', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentDate = new Date();
    
    // Find all paid quizzes that haven't started yet
    const upcomingQuizzes = await prisma.payment.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        quiz: {
          OR: [
            { startDate: { gt: currentDate } },
            {
              AND: [
                { startDate: null },
                { endDate: { gt: currentDate } }
              ]
            }
          ]
        }
      },
      include: {
        quiz: {
          include: {
            questions: {
              select: {
                id: true
              }
            }
          }
        }
      }
    });

    const formattedQuizzes = upcomingQuizzes.map(payment => {
      const quiz = payment.quiz;
      
      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        price: quiz.price,
        startDate: quiz.startDate,
        endDate: quiz.endDate,
        totalQuestions: quiz.questions.length,
        paymentStatus: payment.status,
        paymentDate: payment.createdAt,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt
      };
    });

    res.status(200).json({
      success: true,
      data: formattedQuizzes,
      count: upcomingQuizzes.length
    });
  }
  catch (error) {
    console.error('Error getting user upcoming quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting user upcoming quizzes',
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

      // Parse dates if they're provided
      const parsedStartDate = updates.startDate ? new Date(updates.startDate) : undefined;
      const parsedEndDate = updates.endDate ? new Date(updates.endDate) : undefined;

      // Validate dates if both are provided
      if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
        throw new Error('End date must be after start date');
      }

      if (updates.title || updates.description || updates.price !== undefined || 
          updates.startDate !== undefined || updates.endDate !== undefined) {
        quiz = await prisma.quiz.update({
          where: { id: quizId },
          data: {
            ...(updates.title && { title: updates.title }),
            ...(updates.description && { description: updates.description }),
            ...(updates.price !== undefined && { price: updates.price }),
            ...(parsedStartDate !== undefined && { startDate: parsedStartDate }),
            ...(parsedEndDate !== undefined && { endDate: parsedEndDate })
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
    const currentDate = new Date();
    
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId }
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Check if quiz is upcoming (start date is in the future)
    if (quiz.startDate && quiz.startDate > currentDate) {
      return res.status(403).json({
        success: false,
        message: 'This quiz has not started yet. Please wait until the start date.'
      });
    }

    // Check if quiz is completed (end date is in the past)
    if (quiz.endDate && quiz.endDate < currentDate) {
      return res.status(403).json({
        success: false,
        message: 'This quiz has already ended and is no longer available.'
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

    // If we reach here, the quiz is ongoing and can be joined
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



/**
 * @desc Get questions for a quiz
 * @route GET /api/v1/quiz/:quizId/take
 * @access Private (User only)
 */
router.get('/:quizId/take', authenticate(['USER']), async (req, res) => {
  const { quizId } = req.params;
  const userId = req.user.id;

  try {
    // Check if quiz exists
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            options: {
              select: {
                id: true,
                text: true
              }
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

    // Check if the user has already joined the quiz
    const quizAttempt = await prisma.quizAttempt.findUnique({
      where: {
        userId_quizId: {
          userId,
          quizId
        }
      }
    });

    if (!quizAttempt) {
      return res.status(400).json({
        success: false,
        message: 'You need to join this quiz first'
      });
    }

    if (quizAttempt.completed) {
      return res.status(400).json({
        success: false,
        message: 'You have already completed this quiz'
      });
    }

    // Format the questions to remove correct answers
    const formattedQuestions = quiz.questions.map(question => ({
      id: question.id,
      text: question.text,
      options: question.options.map(option => ({
        id: option.id,
        text: option.text
      }))
    }));

    res.status(200).json({
      success: true,
      data: {
        quizId: quiz.id,
        title: quiz.title,
        description: quiz.description,
        totalQuestions: formattedQuestions.length,
        questions: formattedQuestions
      }
    });
  } catch (error) {
    console.error('Error getting quiz questions:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting quiz questions',
      error: error.message
    });
  }
});

/**
 * @desc Submit answers for a quiz
 * @route POST /api/v1/quiz/:quizId/submit
 * @access Private (User only)
 */
router.post('/:quizId/submit', authenticate(['USER']), async (req, res) => {
  const { quizId } = req.params;
  const { answers } = req.body; // [{ questionId: 'id', answer: 'text' }]
  const userId = req.user.id;

  try {
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'Answers must be an array' });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: { include: { options: true } },
        leaderboard: true
      }
    });

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const quizAttempt = await prisma.quizAttempt.findUnique({
      where: { userId_quizId: { userId, quizId } }
    });

    if (!quizAttempt) {
      return res.status(400).json({ success: false, message: 'Join the quiz before submitting' });
    }

    if (quizAttempt.completed) {
      return res.status(400).json({ success: false, message: 'Quiz already completed' });
    }

    const questionsMap = new Map(quiz.questions.map(q => [q.id, q]));
    let score = 0;

    const results = answers.map(({ questionId, answerId }) => {
      const question = questionsMap.get(questionId);
      if (!question) return { questionId, correct: false, message: 'Invalid question' };

      const correct = question.correctAnswer === answerId;
      
      if (correct) score += 1;

      return { questionId, correct, correctAnswer: question.correctAnswer };
    });

    const totalQuestions = quiz.questions.length;
    const percentageScore = Math.round((score / totalQuestions) * 100);

    const updatedAttempt = await prisma.quizAttempt.update({
      where: { userId_quizId: { userId, quizId } },
      data: { score, completed: true }
    });

    await prisma.leaderBoardEntry.upsert({
      where: {
        leaderboardId_userId: {
          leaderboardId: quiz.leaderboard.id,
          userId
        }
      },
      update: { score },
      create: {
        leaderboardId: quiz.leaderboard.id,
        userId,
        score
      }
    });

    res.status(200).json({
      success: true,
      data: { score, totalQuestions, percentageScore, results, completed: true }
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});


/**
 * @desc Get user's quiz result
 * @route GET /api/v1/quiz/:quizId/result
 * @access Private (User only)
 */
router.get('/:quizId/result', authenticate(['USER']), async (req, res) => {
  const { quizId } = req.params;
  const userId = req.user.id;

  try {
    // Check if the user has completed the quiz
    const quizAttempt = await prisma.quizAttempt.findUnique({
      where: {
        userId_quizId: {
          userId,
          quizId
        }
      },
      include: {
        quiz: {
          include: {
            questions: true,
            leaderboard: {
              include: {
                entries: {
                  orderBy: {
                    score: 'desc'
                  },
                  take: 10,
                  include: {
                    user: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!quizAttempt) {
      return res.status(404).json({
        success: false,
        message: 'Quiz attempt not found'
      });
    }

    if (!quizAttempt.completed) {
      return res.status(400).json({
        success: false,
        message: 'You have not completed this quiz yet'
      });
    }

    // Get user's rank on the leaderboard
    const leaderboardEntries = await prisma.leaderBoardEntry.findMany({
      where: {
        leaderboardId: quizAttempt.quiz.leaderboard.id
      },
      orderBy: {
        score: 'desc'
      }
    });

    const userRank = leaderboardEntries.findIndex(entry => entry.userId === userId) + 1;
    const totalParticipants = leaderboardEntries.length;

    // Calculate percentage score
    const percentageScore = Math.round((quizAttempt.score / quizAttempt.quiz.questions.length) * 100);

    res.status(200).json({
      success: true,
      data: {
        quizId: quizAttempt.quizId,
        quizTitle: quizAttempt.quiz.title,
        score: quizAttempt.score,
        totalQuestions: quizAttempt.quiz.questions.length,
        percentageScore,
        completed: quizAttempt.completed,
        completedAt: quizAttempt.updatedAt,
        rank: userRank,
        totalParticipants,
        topScores: quizAttempt.quiz.leaderboard.entries.map((entry, index) => ({
          rank: index + 1,
          name: entry.user.name,
          score: entry.score
        }))
      }
    });
  } catch (error) {
    console.error('Error getting quiz result:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting quiz result',
      error: error.message
    });
  }
});

export default router;