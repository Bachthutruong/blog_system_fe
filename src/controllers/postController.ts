import { Request, Response } from 'express';
import { Post } from '../models/Post';
import { PostHistory } from '../models/PostHistory';
import { compressAndUploadImage, deleteMultipleImages } from '../utils/cloudinary';

interface AuthRequest extends Request {
  user?: any;
}

export const createPost = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, content, images } = req.body;
    const userId = req.user._id;

    // Create post
    const post = new Post({
      title,
      description,
      content,
      images: [],
      author: userId,
      status: 'draft'
    });

    await post.save();

    // Save to history
    const postHistory = new PostHistory({
      postId: post._id,
      title,
      description,
      content,
      images: [],
      changedBy: userId,
      changeType: 'created'
    });

    await postHistory.save();

    res.status(201).json({
      success: true,
      data: post,
      message: 'Post created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const uploadImages = async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    let { imageNames } = req.body as { imageNames?: string | string[] };
    // Ensure multipart/form-data
    if (!req.is('multipart/form-data')) {
      return res.status(400).json({ success: false, error: 'Content-Type must be multipart/form-data' });
    }

    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No images provided'
      });
    }

    // Normalize imageNames to an array aligned with files
    let normalizedNames: string[] = [];
    if (Array.isArray(imageNames)) {
      normalizedNames = imageNames;
    } else if (typeof imageNames === 'string') {
      normalizedNames = [imageNames];
    } else {
      normalizedNames = [];
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Check if user is author or admin
    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Validate that files are not empty
    const emptyFile = files.find(f => !f.buffer || f.buffer.length === 0);
    if (emptyFile) {
      return res.status(400).json({
        success: false,
        error: 'One or more files are empty. Make sure to send multipart/form-data correctly.'
      });
    }

    const uploadedImages = [];

    // Upload sequentially to control memory; if one fails, continue with others
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const providedName = normalizedNames[i];
        const imageName = (providedName && providedName.trim().length > 0)
          ? providedName
          : (file.originalname?.split('.')?.slice(0, -1)?.join('.') || `image_${i + 1}`);

        const uploadResult = await compressAndUploadImage(file.buffer, imageName, 80, file.mimetype);
        uploadedImages.push({
          name: imageName,
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          width: uploadResult.width,
          height: uploadResult.height
        });
      } catch (e) {
        // Skip failed file but continue others
        // Optionally log: console.error('Upload failed for one file', e)
        continue;
      }
    }

    // Add images to post
    post.images.push(...uploadedImages);
    await post.save();

    // Save to history
    const postHistory = new PostHistory({
      postId: post._id,
      title: post.title,
      description: post.description,
      content: post.content,
      images: post.images,
      changedBy: req.user._id,
      changeType: 'updated'
    });

    await postHistory.save();

    res.json({
      success: true,
      data: uploadedImages,
      message: uploadedImages.length === files.length ? 'Images uploaded successfully' : 'Some images failed to upload'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const updatePost = async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    const { title, description, content, status } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Check if user is author or admin
    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Update post
    post.title = title || post.title;
    post.description = description || post.description;
    post.content = content || post.content;
    if (status && req.user.role === 'admin') {
      post.status = status;
    }

    await post.save();

    // Save to history
    const postHistory = new PostHistory({
      postId: post._id,
      title: post.title,
      description: post.description,
      content: post.content,
      images: post.images,
      changedBy: req.user._id,
      changeType: 'updated'
    });

    await postHistory.save();

    res.json({
      success: true,
      data: post,
      message: 'Post updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const deletePost = async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Only admin can delete posts
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only admins can delete posts.'
      });
    }

    // Delete images from Cloudinary
    const publicIds = post.images.map(img => img.publicId);
    await deleteMultipleImages(publicIds);

    // Delete post and history
    await Post.findByIdAndDelete(postId);
    await PostHistory.deleteMany({ postId });

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const getPosts = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    let query: any = {};
    
    if (status) {
      query.status = status;
    }

    if (search) {
      query.$text = { $search: search as string };
    }

    const posts = await Post.find(query)
      .populate('author', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      data: {
        posts,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const getPostById = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId)
      .populate('author', 'username email');

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    res.json({
      success: true,
      data: post
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const getPostHistory = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;

    const history = await PostHistory.find({ postId })
      .populate('changedBy', 'username email')
      .sort({ changedAt: -1 });

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
