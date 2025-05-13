import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  picture: string;
  accessToken: string;
  refreshToken: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date;
}

const UserSchema: Schema = new Schema(
  {
    email: { 
      type: String, 
      required: true, 
      unique: true 
    },
    name: { 
      type: String, 
      required: true 
    },
    picture: { 
      type: String 
    },
    accessToken: { 
      type: String, 
      required: true 
    },
    refreshToken: { 
      type: String, 
      required: true 
    },
    lastLogin: { 
      type: Date, 
      default: Date.now 
    },
  },
  { 
    timestamps: true 
  }
);

// Check if the model is already defined to prevent overwriting during hot reloads
export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema); 