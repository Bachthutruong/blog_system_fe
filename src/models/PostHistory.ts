import mongoose, { Document, Schema } from 'mongoose';

export interface IPostHistory extends Document {
  postId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  content: string;
  images: Array<{
    name: string;
    url: string;
    publicId: string;
    width: number;
    height: number;
  }>;
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  changeType: 'created' | 'updated';
}

const postHistorySchema = new Schema<IPostHistory>({
  postId: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  images: [{
    name: String,
    url: String,
    publicId: String,
    width: Number,
    height: Number
  }],
  changedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changedAt: {
    type: Date,
    default: Date.now
  },
  changeType: {
    type: String,
    enum: ['created', 'updated'],
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
postHistorySchema.index({ postId: 1, changedAt: -1 });

export const PostHistory = mongoose.model<IPostHistory>('PostHistory', postHistorySchema);
