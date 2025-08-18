/**
 * Test script for Copy Last Week Schedule functionality
 * 
 * This script demonstrates how to use the new copy schedule API endpoints.
 * Run this script to test the functionality.
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api'; // Adjust to your server URL
const DOCTOR_TOKEN = 'your_doctor_jwt_token_here'; // Replace with actual token
const ADMIN_TOKEN = 'your_admin_jwt_token_here'; // Replace with actual token

// Test data
const testDoctorId = 'your_test_doctor_id_here'; // Replace with actual doctor ID

// Helper function to make authenticated requests
const makeRequest = async (method, url, data = null, token = DOCTOR_TOKEN) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    throw error;
  }
};

// Test 1: Copy last week schedule using doctor convenience endpoint
const testDoctorConvenienceEndpoint = async () => {
  console.log('\n=== Test 1: Doctor Convenience Endpoint ===');
  
  try {
    const result = await makeRequest('POST', '/doctors/schedule/copy-last-week');
    
    if (result.success) {
      console.log('✅ Success:', result.message);
      console.log('📊 Summary:', result.data.summary);
      console.log('📅 Copied Schedules:');
      result.data.copiedSchedules.forEach(schedule => {
        console.log(`   ${schedule.dayOfWeek} (${schedule.date}): ${schedule.timeBlocks.length} time blocks`);
      });
    } else {
      console.log('❌ Failed:', result.message);
      if (result.data && result.data.errors) {
        console.log('🚨 Errors:', result.data.errors);
      }
    }
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
};

// Test 2: Copy last week schedule using schedule advanced endpoint
const testScheduleAdvancedEndpoint = async () => {
  console.log('\n=== Test 2: Schedule Advanced Endpoint ===');
  
  try {
    const result = await makeRequest('POST', `/schedule/copy-last-week/${testDoctorId}`);
    
    if (result.success) {
      console.log('✅ Success:', result.message);
      console.log('📊 Summary:', result.data.summary);
      console.log('📅 Copied Schedules:');
      result.data.copiedSchedules.forEach(schedule => {
        console.log(`   ${schedule.dayOfWeek} (${schedule.date}): ${schedule.timeBlocks.length} time blocks`);
      });
    } else {
      console.log('❌ Failed:', result.message);
      if (result.data && result.data.errors) {
        console.log('🚨 Errors:', result.data.errors);
      }
    }
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
};

// Test 3: Copy to specific target week
const testCopyToTargetWeek = async () => {
  console.log('\n=== Test 3: Copy to Specific Target Week ===');
  
  try {
    // Calculate next week's Monday
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMonday = new Date(nextWeek);
    nextMonday.setDate(nextMonday.getDate() - nextMonday.getDay() + 1);
    const targetWeekStart = nextMonday.toISOString().split('T')[0];
    
    console.log(`🎯 Target Week Start: ${targetWeekStart}`);
    
    const result = await makeRequest('POST', `/schedule/copy-last-week/${testDoctorId}`, {
      targetWeekStart
    });
    
    if (result.success) {
      console.log('✅ Success:', result.message);
      console.log('📊 Summary:', result.data.summary);
    } else {
      console.log('❌ Failed:', result.message);
    }
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
};

// Test 4: Test with admin token
const testAdminAccess = async () => {
  console.log('\n=== Test 4: Admin Access Test ===');
  
  try {
    const result = await makeRequest('POST', `/schedule/copy-last-week/${testDoctorId}`, null, ADMIN_TOKEN);
    
    if (result.success) {
      console.log('✅ Admin Success:', result.message);
      console.log('📊 Summary:', result.data.summary);
    } else {
      console.log('❌ Admin Failed:', result.message);
    }
  } catch (error) {
    console.error('💥 Admin Error:', error.message);
  }
};

// Test 5: Test permission denied (doctor trying to copy another doctor's schedule)
const testPermissionDenied = async () => {
  console.log('\n=== Test 5: Permission Denied Test ===');
  
  try {
    const result = await makeRequest('POST', `/schedule/copy-last-week/${testDoctorId}`, null, DOCTOR_TOKEN);
    
    if (result.success) {
      console.log('⚠️  Unexpected Success (should have been denied)');
    } else {
      console.log('✅ Permission Correctly Denied:', result.message);
    }
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting Copy Last Week Schedule Tests...');
  console.log('📝 Make sure to update the configuration variables at the top of this script');
  
  // Check if configuration is set
  if (DOCTOR_TOKEN === 'your_doctor_jwt_token_here' || 
      testDoctorId === 'your_test_doctor_id_here') {
    console.log('\n⚠️  Please update the configuration variables:');
    console.log('   - DOCTOR_TOKEN: Your JWT token for a doctor user');
    console.log('   - ADMIN_TOKEN: Your JWT token for an admin user');
    console.log('   - testDoctorId: ID of a test doctor');
    console.log('\n   Then run this script again.');
    return;
  }
  
  await testDoctorConvenienceEndpoint();
  await testScheduleAdvancedEndpoint();
  await testCopyToTargetWeek();
  await testAdminAccess();
  await testPermissionDenied();
  
  console.log('\n🎉 All tests completed!');
};

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testDoctorConvenienceEndpoint,
  testScheduleAdvancedEndpoint,
  testCopyToTargetWeek,
  testAdminAccess,
  testPermissionDenied
};

