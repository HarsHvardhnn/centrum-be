const User = require('../models/user-entity/user');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const connectDB = require('../config/db');

dotenv.config();

const updateAdminPassword = async (newPassword) => {
    try {
        await connectDB();
        
        // Find admin user
        const admin = await User.findOne({ role: "admin" });
        
        if (!admin) {
            console.log('No admin user found!');
            process.exit(1);
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        admin.password = hashedPassword;
        await admin.save();

        console.log('Admin password updated successfully!');
        console.log('New admin credentials:');
        console.log('Email:', admin.email);
        console.log('Password:', newPassword);

    } catch (error) {
        console.error('Error updating admin password:', error);
    } finally {
        process.exit();
    }
};

// Get password from command line argument
const newPassword = process.argv[2];

if (!newPassword) {
    console.log('Please provide a new password as an argument:');
    console.log('Example: node scripts/updateAdminPassword.js YourNewPassword123');
    process.exit(1);
}

updateAdminPassword(newPassword); 