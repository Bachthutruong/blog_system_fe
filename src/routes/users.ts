import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUserByAdmin,
  updateUser,
  deleteUser,
  changePassword
} from '../controllers/userController';
import { auth, requireAdmin } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Admin only routes
router.get('/', requireAdmin, getAllUsers);
router.post('/', requireAdmin, createUserByAdmin);
router.get('/:userId', requireAdmin, getUserById);
router.put('/:userId', requireAdmin, updateUser);
router.delete('/:userId', requireAdmin, deleteUser);

// User can change their own password
router.post('/change-password', changePassword);

export default router;
