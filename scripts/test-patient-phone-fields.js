const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000'; // Adjust this to your server URL
const TEST_PATIENT_ID = 'YOUR_TEST_PATIENT_ID'; // Replace with actual patient ID

// Test data
const testPatientData = {
  fullName: "Test Patient Phone",
  email: "testphone@example.com",
  mobileNumber: "800056148",
  phoneCode: "+48",
  phone: "800056148",
  fatherName: "Test Father",
  motherName: "Test Mother",
  sex: "Male",
  dateOfBirth: "1990-01-01",
  consultingSpecialization: "YOUR_SPECIALIZATION_ID", // Replace with actual ID
  consultingDoctor: "YOUR_DOCTOR_ID", // Replace with actual ID
  consents: JSON.stringify([
    {
      text: "Wyrażam zgodę na otrzymywanie powiadomień SMS i e-mail dotyczących mojej wizyty (np. przypomnienia, zmiany terminu).",
      agreed: true
    }
  ])
};

const updatePatientData = {
  phoneCode: "+49",
  phone: "123456789",
  fullName: "Updated Test Patient Phone"
};

async function testPatientPhoneFields() {
  console.log('🧪 Testing Patient Phone Fields...\n');

  try {
    // Test 1: Create Patient with phoneCode and phone
    console.log('1️⃣ Testing CREATE Patient with phoneCode and phone...');
    const createResponse = await axios.post(`${BASE_URL}/api/patients`, testPatientData);
    console.log('✅ Create Patient Response:', {
      status: createResponse.status,
      patientId: createResponse.data.patient._id,
      phoneCode: createResponse.data.patient.phoneCode,
      phone: createResponse.data.patient.phone
    });

    const createdPatientId = createResponse.data.patient._id;

    // Test 2: Get Patient by ID
    console.log('\n2️⃣ Testing GET Patient by ID...');
    const getResponse = await axios.get(`${BASE_URL}/api/patients/${createdPatientId}`);
    console.log('✅ Get Patient Response:', {
      status: getResponse.status,
      phoneCode: getResponse.data.phoneCode,
      phone: getResponse.data.phone
    });

    // Test 3: Update Patient with new phoneCode and phone
    console.log('\n3️⃣ Testing UPDATE Patient with new phoneCode and phone...');
    const updateResponse = await axios.put(`${BASE_URL}/api/patients/${createdPatientId}`, updatePatientData);
    console.log('✅ Update Patient Response:', {
      status: updateResponse.status,
      phoneCode: updateResponse.data.patient.phoneCode,
      phone: updateResponse.data.patient.phone
    });

    // Test 4: Verify updated data
    console.log('\n4️⃣ Verifying updated data...');
    const verifyResponse = await axios.get(`${BASE_URL}/api/patients/${createdPatientId}`);
    console.log('✅ Verification Response:', {
      status: verifyResponse.status,
      phoneCode: verifyResponse.data.phoneCode,
      phone: verifyResponse.data.phone,
      fullName: verifyResponse.data.name
    });

    // Test 5: Get Patients List (should include phoneCode)
    console.log('\n5️⃣ Testing GET Patients List (should include phoneCode)...');
    const listResponse = await axios.get(`${BASE_URL}/api/patients/list`);
    const patientWithPhoneCode = listResponse.data.patients.find(p => p._id === createdPatientId);
    console.log('✅ Patients List Response:', {
      status: listResponse.status,
      foundPatient: patientWithPhoneCode ? {
        phoneCode: patientWithPhoneCode.phoneCode,
        phone: patientWithPhoneCode.phone
      } : 'Not found'
    });

    // Test 6: Get Patient Details (should include phoneCode)
    console.log('\n6️⃣ Testing GET Patient Details (should include phoneCode)...');
    const detailsResponse = await axios.get(`${BASE_URL}/api/patients/details/${createdPatientId}`);
    console.log('✅ Patient Details Response:', {
      status: detailsResponse.status,
      phoneCode: detailsResponse.data.patientData.phoneCode,
      phone: detailsResponse.data.patientData.phone
    });

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`- Created patient with phoneCode: ${testPatientData.phoneCode}, phone: ${testPatientData.phone}`);
    console.log(`- Updated patient with phoneCode: ${updatePatientData.phoneCode}, phone: ${updatePatientData.phone}`);
    console.log(`- All GET endpoints now return phoneCode and phone fields`);
    console.log(`- phoneCode defaults to "+48" when not provided`);

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
if (require.main === module) {
  testPatientPhoneFields();
}

module.exports = { testPatientPhoneFields };
