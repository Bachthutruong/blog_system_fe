import express from 'express';
import multer from 'multer';
import {
  createPost,
  uploadImages,
  updatePost,
  deletePost,
  deleteImageFromPost,
  updateImageName,
  getPosts,
  getPostById,
  getPostHistory
} from '../controllers/postController';
import { auth, requireEmployee, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per file
    files: 20 // Up to 20 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Public routes
router.get('/', getPosts);
router.get('/:postId', getPostById);
router.get('/:postId/history', getPostHistory);

// Protected routes - require employee role
router.post('/', auth, requireEmployee, createPost);
router.put('/:postId', auth, requireEmployee, updatePost);
// Accept any multipart files to be tolerant of different field names
router.post('/:postId/images', auth, requireEmployee, upload.any(), uploadImages);
router.put('/:postId/images/:imageId', auth, requireEmployee, updateImageName);
router.delete('/:postId/images/:imageId', auth, requireEmployee, deleteImageFromPost);

// Admin only routes
router.delete('/:postId', auth, requireAdmin, deletePost);

export default router;
