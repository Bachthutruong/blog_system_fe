import { Request, Response } from 'express';
import { Post } from '../models/Post';
import { PostHistory } from '../models/PostHistory';
import { compressAndUploadImage, deleteMultipleImages, deleteImage } from '../utils/cloudinary';

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

    console.log('Received files:', files?.length || 0);
    console.log('Files details:', files?.map(f => ({ 
      fieldname: f.fieldname, 
      originalname: f.originalname, 
      mimetype: f.mimetype, 
      size: f.size,
      bufferLength: f.buffer?.length || 0 
    })));

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

    // Upload in parallel for better performance
    const failedUploads: Array<{ index: number; error: string }> = [];
    const uploadPromises = files.map(async (file, i) => {
      try {
        const providedName = normalizedNames[i];
        const imageName = (providedName && providedName.trim().length > 0)
          ? providedName
          : (file.originalname?.split('.')?.slice(0, -1)?.join('.') || `image_${i + 1}`);

        console.log(`Starting upload ${i + 1}/${files.length}: ${imageName}`);
        const uploadResult = await compressAndUploadImage(file.buffer, imageName, 80, file.mimetype);
        console.log(`Successfully uploaded: ${imageName}`);
        
        return {
          name: imageName,
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          width: uploadResult.width,
          height: uploadResult.height
        };
      } catch (e) {
        console.error(`Upload failed for image ${i + 1}:`, e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        failedUploads.push({ index: i + 1, error: errorMessage });
        return null;
      }
    });

    // Wait for all uploads to complete
    const results = await Promise.all(uploadPromises);
    
    // Filter out failed uploads (null values)
    const successfulUploads = results.filter(result => result !== null);
    uploadedImages.push(...successfulUploads);

    if (failedUploads.length > 0) {
      console.log(`Failed uploads:`, failedUploads);
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

    // Prepare response message
    let message = 'Images uploaded successfully';
    if (uploadedImages.length === 0) {
      message = 'All images failed to upload';
    } else if (uploadedImages.length < files.length) {
      message = `${uploadedImages.length}/${files.length} images uploaded successfully. Some images failed to upload.`;
    }

    res.json({
      success: uploadedImages.length > 0,
      data: uploadedImages,
      message,
      failedCount: files.length - uploadedImages.length,
      totalCount: files.length
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

    const post = await Post.findById(postId).populate('author', 'role');
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Check permissions: Only author can edit, or admin can edit any post
    // But employee/staff cannot edit admin's posts
    const isAuthor = post.author._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only edit your own posts.'
      });
    }
    
    // If user is employee/staff, they cannot edit admin's posts
    if (!isAuthor && req.user.role === 'employee' && (post.author as any).role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Staff cannot edit admin posts.'
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

export const updateImageName = async (req: AuthRequest, res: Response) => {
  try {
    const { postId, imageId } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Image name is required'
      });
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

    // Find image to update
    const imageIndex = post.images.findIndex((img: any) => img._id?.toString() === imageId);
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    // Update image name
    post.images[imageIndex].name = name.trim();
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
      message: 'Image name updated successfully',
      data: post.images[imageIndex]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const deleteImageFromPost = async (req: AuthRequest, res: Response) => {
  try {
    const { postId, imageId } = req.params;

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

    // Find image to delete
    const imageIndex = post.images.findIndex((img: any) => img._id?.toString() === imageId);
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    const imageToDelete = post.images[imageIndex];

    // Delete from Cloudinary
    try {
      await deleteImage(imageToDelete.publicId);
    } catch (cloudinaryError) {
      console.error('Failed to delete from Cloudinary:', cloudinaryError);
      // Continue anyway to remove from database
    }

    // Remove from post
    post.images.splice(imageIndex, 1);
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
      message: 'Image deleted successfully'
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
      .populate('author', 'username email role')
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
