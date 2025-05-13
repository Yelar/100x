import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/email-ai';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

interface Cached {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Global is used to maintain connection across hot reloads
const globalWithMongoose = global as unknown as {
  mongoose: Cached | undefined;
};

// Initialize the cached object
let cached: Cached;

if (!globalWithMongoose.mongoose) {
  cached = globalWithMongoose.mongoose = {
    conn: null,
    promise: null
  };
} else {
  cached = globalWithMongoose.mongoose;
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then(() => mongoose);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase; 