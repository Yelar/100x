import mongoose, { Schema, Document } from 'mongoose';

export interface IChatUsage extends Document {
  userEmail: string;
  date: string; // YYYY-MM-DD
  count: number;
}

const ChatUsageSchema: Schema<IChatUsage> = new Schema(
  {
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

ChatUsageSchema.index({ userEmail: 1, date: 1 }, { unique: true });

// Prevent model overwrite in Next.js hot reload
export default mongoose.models.ChatUsage || mongoose.model<IChatUsage>('ChatUsage', ChatUsageSchema); 