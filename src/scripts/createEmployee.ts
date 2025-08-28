import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User';

// Load environment variables
dotenv.config();

const createEmployeeUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    // Check if employee already exists
    const existingEmployee = await User.findOne({ email: 'employee@example.com' });
    if (existingEmployee) {
      console.log('Employee user already exists:', existingEmployee.username);
      process.exit(0);
    }

    // Create employee user (let Mongoose pre-save hook hash the password)
    const employeeUser = new User({
      username: 'employee',
      email: 'employee@example.com',
      password: 'employee123',
      role: 'employee'
    });

    await employeeUser.save();
    
    console.log('✅ Employee user created successfully!');
    console.log('Username: employee');
    console.log('Email: employee@example.com');
    console.log('Password: employee123');
    console.log('Role: employee');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating employee user:', error);
    process.exit(1);
  }
};

createEmployeeUser();
