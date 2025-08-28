import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User';

dotenv.config();

const resetAdminPassword = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    const admin = await User.findOne({ email: 'admin@example.com' });
    if (!admin) {
      console.log('Admin not found. Creating one...');
      const newAdmin = new User({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin',
      });
      await newAdmin.save();
      console.log('✅ Admin created with default password admin123');
      process.exit(0);
    }

    admin.password = 'admin123';
    await admin.save();
    console.log('✅ Admin password reset to admin123');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

resetAdminPassword();


