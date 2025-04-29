// const mongoose = require("mongoose");
// const User = require("./user");

// const patientHealthDataSchema = new mongoose.Schema({
//   bloodPressure: {
//     value: String,
//     percentage: Number, 
//     temperature: Number, 
//   },
//   bodyHeight: {
//     value: String, 
//     percentage: Number, // e.g. 30%
//   },
//   bodyWeight: {
//     value: Number, // e.g. 78kg
//     percentage: Number, // e.g. 30%
//   },
// });

// const consultationSchema = new mongoose.Schema({
//   consultationType: {
//     type: String,
//     enum: ["Clinic Consulting", "Online Consultation", "Home Visit"],
//   },
//   consultationNotes: String,
//   consultationTime: Date, // Stores time like 11:20 pm
//   consultationDate: Date, // Stores date like 16-12-2021
//   roomNumber: Number,
//   consultationStatus: {
//     type: String,
//     enum: ["Scheduled", "In Progress", "Completed", "Cancelled"],
//   },
//   isRisky: Boolean,
//   isOnline: Boolean,
// });

// const enhancedPatientSchema = new mongoose.Schema({
//   currentStatus: {
//     roomNumber: Number,
//     isRisky: Boolean,
//     treatmentStatus: {
//       type: String,
//       enum: ["Under Treatment", "Completed", "Pending", "Scheduled"],
//     },
//   },
//   phoneFormatted: String, // For formatted phone numbers like (704)-555-0127


//   chronicConditions: [String],

//   specialty: {
//     type: String,
//     enum: [
//       "Cardiology",
//       "Neurology",
//       "Orthopedics",
//       "Pediatrics",
//       "General Medicine",
//       "Other",
//     ],
//   },

//   consultations: [consultationSchema],

//   healthData: patientHealthDataSchema,

//   isInternationalPatient: {
//     type: Boolean,
//     default: false,
//   },

//   reviewNotes: String,

//   // Reference to the current doctor
//   attendingPhysician: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//   },

//   // Goals and monitoring plans
//   goals: [String],
//   monitoringPlan: {
//     type: mongoose.Schema.Types.Mixed,
//   },

//   // Tests and medications
//   tests: [
//     {
//       name: String,
//       date: Date,
//       results: mongoose.Schema.Types.Mixed,
//       status: String,
//     },
//   ],

//   medications: [
//     {
//       name: String,
//       dosage: String,
//       frequency: String,
//       startDate: Date,
//       endDate: Date,
//       status: String,
//     },
//   ],
// });

// module.exports = User.discriminator("patient", enhancedPatientSchema);
