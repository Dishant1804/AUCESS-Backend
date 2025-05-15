import express from 'express';
import { PrismaClient } from '@prisma/client';
import authMiddleware from './middleware/authMiddleware.js'
import authenticate from './middleware/authenticate.js';

const prisma = new PrismaClient();
const router = express.Router();

/**
 * @route GET /api/users
 * @desc Get all users
 * @access Private (Admin and SubAdmin only)
 */
router.get('/', authMiddleware, authenticate(['ADMIN', 'SUB_ADMIN']), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            }
        });

        // Get total count of users
        const totalUsers = await prisma.user.count();

        // Get counts by role
        const usersByRole = await prisma.user.groupBy({
            by: ['role'],
            _count: {
                id: true
            }
        });

        const roleCounts = {};
        usersByRole.forEach(item => {
            roleCounts[item.role] = item._count.id;
        });

        res.status(200).json({ 
            success: true, 
            data: users, 
            count: totalUsers,
            roleCounts
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private (User can access own data, Admin/SubAdmin can access any)
 */
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user is requesting their own data or is admin/subadmin
        if (req.user.id !== id && !['ADMIN', 'SUB_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only access your own user details.'
            });
        }

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                quizAttempts: {
                    include: {
                        quiz: {
                            select: {
                                id: true,
                                title: true
                            }
                        }
                    }
                },
                leaderboardEntries: {
                    include: {
                        leaderboard: {
                            select: {
                                id: true,
                                quiz: {
                                    select: {
                                        id: true,
                                        title: true
                                    }
                                }
                            }
                        }
                    }
                },
                payments: true
            }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({ success: true, data: user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

export default router;