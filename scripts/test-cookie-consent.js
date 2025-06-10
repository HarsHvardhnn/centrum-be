/**
 * Test script for Cookie Consent API
 * Run with: node scripts/test-cookie-consent.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000'; // Adjust based on your server setup
const API_URL = `${BASE_URL}/api/cookie-consent`;

// Test data
const testConsent = {
  consent: {
    analytics: true,
    marketing: false,
    preferences: true,
    version: '1.0'
  }
};

// Mock authentication token (replace with a real token for testing)
const AUTH_TOKEN = 'your-jwt-token-here';

const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};

// Test functions
const testHealthCheck = async () => {
  try {
    console.log('\n🏥 Testing Health Check...');
    const response = await axios.get(`${API_URL}/health`);
    console.log('✅ Health Check Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health Check Failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetConsentEmpty = async () => {
  try {
    console.log('\n📝 Testing Get Consent (Empty)...');
    const response = await axios.get(API_URL, { headers });
    console.log('✅ Get Consent (Empty) Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Get Consent (Empty) Failed:', error.response?.data || error.message);
    return false;
  }
};

const testSaveConsent = async () => {
  try {
    console.log('\n💾 Testing Save Consent...');
    const response = await axios.post(API_URL, testConsent, { headers });
    console.log('✅ Save Consent Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Save Consent Failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetConsent = async () => {
  try {
    console.log('\n📄 Testing Get Consent...');
    const response = await axios.get(API_URL, { headers });
    console.log('✅ Get Consent Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Get Consent Failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetConsentStatus = async () => {
  try {
    console.log('\n📊 Testing Get Consent Status...');
    const response = await axios.get(`${API_URL}/status`, { headers });
    console.log('✅ Get Consent Status Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Get Consent Status Failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetConsentHistory = async () => {
  try {
    console.log('\n📚 Testing Get Consent History...');
    const response = await axios.get(`${API_URL}/history`, { headers });
    console.log('✅ Get Consent History Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Get Consent History Failed:', error.response?.data || error.message);
    return false;
  }
};

const testUpdateConsent = async () => {
  try {
    console.log('\n🔄 Testing Update Consent...');
    const updatedConsent = {
      consent: {
        analytics: false,
        marketing: true,
        preferences: false,
        version: '1.1'
      }
    };
    const response = await axios.post(API_URL, updatedConsent, { headers });
    console.log('✅ Update Consent Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Update Consent Failed:', error.response?.data || error.message);
    return false;
  }
};

const testDeleteConsent = async () => {
  try {
    console.log('\n🗑️ Testing Delete Consent...');
    const response = await axios.delete(API_URL, { headers });
    console.log('✅ Delete Consent Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Delete Consent Failed:', error.response?.data || error.message);
    return false;
  }
};

const testValidationErrors = async () => {
  try {
    console.log('\n⚠️ Testing Validation Errors...');
    const invalidConsent = {
      consent: {
        analytics: 'invalid', // Should be boolean
        marketing: false,
        preferences: true
      }
    };
    const response = await axios.post(API_URL, invalidConsent, { headers });
    console.log('❌ Validation test failed - should have returned error');
    return false;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Validation Error Response:', error.response.data);
      return true;
    } else {
      console.error('❌ Unexpected error:', error.response?.data || error.message);
      return false;
    }
  }
};

// Main test function
const runTests = async () => {
  console.log('🚀 Starting Cookie Consent API Tests...');
  console.log('📍 API URL:', API_URL);
  
  if (!AUTH_TOKEN || AUTH_TOKEN === 'your-jwt-token-here') {
    console.log('\n⚠️ Warning: Please set a valid AUTH_TOKEN in the script for full testing');
    console.log('ℹ️ Running health check only...\n');
    await testHealthCheck();
    return;
  }

  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Get Consent (Empty)', fn: testGetConsentEmpty },
    { name: 'Save Consent', fn: testSaveConsent },
    { name: 'Get Consent', fn: testGetConsent },
    { name: 'Get Consent Status', fn: testGetConsentStatus },
    { name: 'Get Consent History', fn: testGetConsentHistory },
    { name: 'Update Consent', fn: testUpdateConsent },
    { name: 'Validation Errors', fn: testValidationErrors },
    { name: 'Delete Consent', fn: testDeleteConsent }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await test.fn();
    if (result) {
      passed++;
    } else {
      failed++;
    }
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Cookie Consent API is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the errors above.');
  }
};

// Run the tests
runTests().catch(console.error); 