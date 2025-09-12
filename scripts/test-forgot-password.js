/**
 * Test script for forgot password functionality
 * This script tests the complete password reset flow
 */

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

// Configuration
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.BACKEND_URL 
  : 'http://localhost:3000';

const API_BASE = `${BASE_URL}/api/auth`;

// Test data
const TEST_USER = {
  email: 'test-doctor@example.com',
  phone: '+48123456789',
  role: 'doctor'
};

// Helper function to make API requests
const makeRequest = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
};

// Test 1: Request password reset with email
const testRequestPasswordResetWithEmail = async () => {
  console.log('\n=== Test 1: Request Password Reset with Email ===');
  
  const result = await makeRequest('POST', '/forgot-password', {
    email: TEST_USER.email
  });

  if (result.success) {
    console.log('✅ Password reset request successful');
    console.log('Response:', result.data);
    return result.data;
  } else {
    console.log('❌ Password reset request failed');
    console.log('Error:', result.error);
    return null;
  }
};

// Test 2: Request password reset with phone
const testRequestPasswordResetWithPhone = async () => {
  console.log('\n=== Test 2: Request Password Reset with Phone ===');
  
  const result = await makeRequest('POST', '/forgot-password', {
    phone: TEST_USER.phone
  });

  if (result.success) {
    console.log('✅ Password reset request successful');
    console.log('Response:', result.data);
    return result.data;
  } else {
    console.log('❌ Password reset request failed');
    console.log('Error:', result.error);
    return null;
  }
};

// Test 3: Test with invalid user
const testInvalidUser = async () => {
  console.log('\n=== Test 3: Invalid User ===');
  
  const result = await makeRequest('POST', '/forgot-password', {
    email: 'nonexistent@example.com'
  });

  if (!result.success && result.status === 404) {
    console.log('✅ Invalid user correctly rejected');
    console.log('Error:', result.error);
    return true;
  } else {
    console.log('❌ Invalid user test failed');
    console.log('Result:', result);
    return false;
  }
};

// Test 4: Test with invalid OTP
const testInvalidOTP = async () => {
  console.log('\n=== Test 4: Invalid OTP ===');
  
  const result = await makeRequest('POST', '/reset-password', {
    email: TEST_USER.email,
    otp: '000000',
    newPassword: 'newPassword123'
  });

  if (!result.success && result.status === 400) {
    console.log('✅ Invalid OTP correctly rejected');
    console.log('Error:', result.error);
    return true;
  } else {
    console.log('❌ Invalid OTP test failed');
    console.log('Result:', result);
    return false;
  }
};

// Test 5: Test rate limiting for resend
const testRateLimiting = async () => {
  console.log('\n=== Test 5: Rate Limiting ===');
  
  // First request
  const result1 = await makeRequest('POST', '/resend-password-reset-otp', {
    email: TEST_USER.email
  });

  // Immediate second request (should be rate limited)
  const result2 = await makeRequest('POST', '/resend-password-reset-otp', {
    email: TEST_USER.email
  });

  if (!result2.success && result2.status === 400) {
    console.log('✅ Rate limiting working correctly');
    console.log('Second request error:', result2.error);
    return true;
  } else {
    console.log('❌ Rate limiting test failed');
    console.log('Second request result:', result2);
    return false;
  }
};

// Test 6: Test validation errors
const testValidationErrors = async () => {
  console.log('\n=== Test 6: Validation Errors ===');
  
  // Test missing email and phone
  const result1 = await makeRequest('POST', '/forgot-password', {});
  
  if (!result1.success && result1.status === 400) {
    console.log('✅ Missing email/phone validation working');
  } else {
    console.log('❌ Missing email/phone validation failed');
  }

  // Test invalid email format
  const result2 = await makeRequest('POST', '/forgot-password', {
    email: 'invalid-email'
  });

  if (!result2.success && result2.status === 400) {
    console.log('✅ Invalid email format validation working');
  } else {
    console.log('❌ Invalid email format validation failed');
  }

  // Test invalid phone format
  const result3 = await makeRequest('POST', '/forgot-password', {
    phone: '123'
  });

  if (!result3.success && result3.status === 400) {
    console.log('✅ Invalid phone format validation working');
  } else {
    console.log('❌ Invalid phone format validation failed');
  }

  return true;
};

// Test 7: Test password validation
const testPasswordValidation = async () => {
  console.log('\n=== Test 7: Password Validation ===');
  
  const result = await makeRequest('POST', '/reset-password', {
    email: TEST_USER.email,
    otp: '123456',
    newPassword: '123' // Too short
  });

  if (!result.success && result.status === 400) {
    console.log('✅ Password length validation working');
    console.log('Error:', result.error);
    return true;
  } else {
    console.log('❌ Password validation test failed');
    console.log('Result:', result);
    return false;
  }
};

// Test 8: Test OTP format validation
const testOTPFormatValidation = async () => {
  console.log('\n=== Test 8: OTP Format Validation ===');
  
  const result = await makeRequest('POST', '/reset-password', {
    email: TEST_USER.email,
    otp: '123', // Too short
    newPassword: 'newPassword123'
  });

  if (!result.success && result.status === 400) {
    console.log('✅ OTP format validation working');
    console.log('Error:', result.error);
    return true;
  } else {
    console.log('❌ OTP format validation test failed');
    console.log('Result:', result);
    return false;
  }
};

// Test 9: Check OTP database
const checkOTPDatabase = async () => {
  console.log('\n=== Test 9: OTP Database Check ===');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/centrum-v3');
    console.log('Connected to database');

    const OTP = require('../models/otp');
    const User = require('../models/user-entity/user');

    // Find test user
    const testUser = await User.findOne({ 
      role: { $in: ['doctor', 'receptionist'] },
      $or: [{ email: TEST_USER.email }, { phone: TEST_USER.phone }]
    });

    if (testUser) {
      console.log(`✅ Found test user: ${testUser.email || testUser.phone} (${testUser.role})`);
      
      // Check for OTP records
      const otpRecords = await OTP.find({ 
        userId: testUser._id,
        purpose: 'password-reset'
      });

      console.log(`📊 Found ${otpRecords.length} password reset OTP records`);
      
      otpRecords.forEach((otp, index) => {
        console.log(`  OTP ${index + 1}:`, {
          deliveryMethod: otp.deliveryMethod,
          attempts: otp.attempts,
          createdAt: otp.createdAt,
          expires: otp.hasExpired() ? 'Expired' : 'Valid'
        });
      });

      return true;
    } else {
      console.log('⚠️  No test user found. Create a doctor or receptionist user to test.');
      return false;
    }
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    return false;
  } finally {
    await mongoose.connection.close();
  }
};

// Main test function
const runTests = async () => {
  console.log('🚀 Starting Forgot Password API Tests');
  console.log(`📍 Testing against: ${API_BASE}`);
  
  const results = [];

  // Run all tests
  results.push(await testRequestPasswordResetWithEmail());
  results.push(await testRequestPasswordResetWithPhone());
  results.push(await testInvalidUser());
  results.push(await testInvalidOTP());
  results.push(await testRateLimiting());
  results.push(await testValidationErrors());
  results.push(await testPasswordValidation());
  results.push(await testOTPFormatValidation());
  results.push(await checkOTPDatabase());

  // Summary
  console.log('\n=== Test Summary ===');
  const passed = results.filter(r => r === true).length;
  const total = results.length;
  console.log(`✅ Passed: ${passed}/${total}`);

  if (passed === total) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check the output above for details.');
  }
};

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`
Forgot Password API Test Script

Usage: node scripts/test-forgot-password.js [options]

Options:
  --help     Show this help message

This script tests the complete forgot password flow including:
- Password reset requests (email and phone)
- OTP validation
- Rate limiting
- Input validation
- Database operations

Make sure the server is running before executing tests.
  `);
  process.exit(0);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  makeRequest,
  testRequestPasswordResetWithEmail,
  testRequestPasswordResetWithPhone,
  testInvalidUser,
  testInvalidOTP,
  testRateLimiting,
  testValidationErrors,
  testPasswordValidation,
  testOTPFormatValidation,
  checkOTPDatabase
};
