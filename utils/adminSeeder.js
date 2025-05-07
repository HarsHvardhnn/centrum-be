const User = require('../models/user-entity/user');
const bcrypt = require('bcrypt');

const adminData = {
    name: {
        first: "Super",
        last: "Admin"
    },
    email: "admin@centrum.com",
    password: "Admin@123", // This will be hashed before saving
    role: "admin",
    isVerified: true,
    signupMethod: "email",
};

const seedAdmin = async () => {
    try {
        // Check if admin already exists
        const existingAdmin = await User.findOne({ role: "admin" });
        
        if (existingAdmin) {
            console.log('Admin already exists. Skipping seeding.');
            return;
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminData.password, salt);

        // Create new admin with hashed password
        const admin = new User({
            ...adminData,
            password: hashedPassword
        });

        await admin.save();
        console.log('Admin seeded successfully!');
        console.log('Admin Email:', adminData.email);
        console.log('Admin Password:', adminData.password);

    } catch (error) {
        console.error('Error seeding admin:', error);
    }
};

module.exports = seedAdmin; 