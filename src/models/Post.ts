import mongoose, { Document, Schema } from 'mongoose';

export interface IPostImage {
  name: string;
  url: string;
  publicId: string;
  width: number;
  height: number;
}

export interface IPost extends Document {
  title: string;
  description: string;
  content: string;
  images: IPostImage[];
  author: mongoose.Types.ObjectId;
  status: 'draft' | 'published';
}

const postImageSchema = new Schema<IPostImage>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true
  },
  publicId: {
    type: String,
    required: true
  },
  width: {
    type: Number,
    required: true
  },
  height: {
    type: Number,
    required: true
  }
});

const postSchema = new Schema<IPost>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: false,
    default: '',
    trim: true,
    maxlength: 500
  },
  content: {
    type: String,
    required: false,
    default: ''
  },
  images: [postImageSchema],
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft'
  }
}, {
  timestamps: true
});

// Index for search
postSchema.index({ title: 'text', description: 'text', content: 'text' });

export const Post = mongoose.model<IPost>('Post', postSchema);
