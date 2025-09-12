/**
 * Script to create a test user for password reset testing
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const createTestUser = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/centrum-v3');
    console.log('Connected to database');
    
    const User = require('../models/user-entity/user');
    
    // Test user data
    const testUserData = {
      name: {
        first: 'Test',
        last: 'Doctor'
      },
      email: 'test-doctor@example.com',
      phone: '+48123456789',
      password: await bcrypt.hash('testPassword123', 10),
      role: 'doctor',
      signupMethod: 'email'
    };
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: testUserData.email },
        { phone: testUserData.phone }
      ]
    });
    
    if (existingUser) {
      console.log(`User already exists: ${existingUser.email || existingUser.phone} (${existingUser.role})`);
      
      // Update the user to ensure it has the right data
      existingUser.name = testUserData.name;
      existingUser.email = testUserData.email;
      existingUser.phone = testUserData.phone;
      existingUser.role = testUserData.role;
      existingUser.password = testUserData.password;
      existingUser.deleted = false;
      
      await existingUser.save();
      console.log('✅ User updated successfully');
    } else {
      // Create new user
      const newUser = new User(testUserData);
      await newUser.save();
      console.log('✅ User created successfully');
    }
    
    // Also create a receptionist user
    const receptionistData = {
      name: {
        first: 'Test',
        last: 'Receptionist'
      },
      email: 'test-receptionist@example.com',
      phone: '+48987654321',
      password: await bcrypt.hash('testPassword123', 10),
      role: 'receptionist',
      signupMethod: 'email'
    };
    
    const existingReceptionist = await User.findOne({ 
      $or: [
        { email: receptionistData.email },
        { phone: receptionistData.phone }
      ]
    });
    
    if (existingReceptionist) {
      console.log(`Receptionist already exists: ${existingReceptionist.email || existingReceptionist.phone} (${existingReceptionist.role})`);
      
      // Update the receptionist
      existingReceptionist.name = receptionistData.name;
      existingReceptionist.email = receptionistData.email;
      existingReceptionist.phone = receptionistData.phone;
      existingReceptionist.role = receptionistData.role;
      existingReceptionist.password = receptionistData.password;
      existingReceptionist.deleted = false;
      
      await existingReceptionist.save();
      console.log('✅ Receptionist updated successfully');
    } else {
      // Create new receptionist
      const newReceptionist = new User(receptionistData);
      await newReceptionist.save();
      console.log('✅ Receptionist created successfully');
    }
    
    console.log('\n📋 Test Users Created:');
    console.log('👨‍⚕️  Doctor:');
    console.log(`   Email: ${testUserData.email}`);
    console.log(`   Phone: ${testUserData.phone}`);
    console.log(`   Password: testPassword123`);
    console.log('\n👩‍💼 Receptionist:');
    console.log(`   Email: ${receptionistData.email}`);
    console.log(`   Phone: ${receptionistData.phone}`);
    console.log(`   Password: testPassword123`);
    
    console.log('\n🧪 You can now test the forgot password functionality with these users.');
    
  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

createTestUser();
