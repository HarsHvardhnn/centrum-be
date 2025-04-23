const mongoose = require("mongoose");
const User = require("./user");

const patientSchema = new mongoose.Schema({
  fatherName: String,
  motherName: String,
  spouseName: String,
  sex: String,
  username: String,
  patientId: String,
  dateOfBirth: Date,
  username: {
    type: String,
    unique: true,
  },
  age: Number,
  birthWeight: String,
  bloodGroup: String,
  maritalStatus: String,
  motherTongue: String,
  religion: String,
  ethnicity: String,
  education: String,
  occupation: String,
  address: String,
  city: String,
  district: String,
  state: String,
  country: String,
  pinCode: String,
  alternateContact: String,
  govtId: String,
  isInternationalPatient: Boolean,
  ivrLanguage: String,
  mainComplaint: String,
  reviewNotes: String,
  consultingDepartment: String,
  consultingDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  status: {
    type: String,
    enum: ["completed", "in-treatment"],
    default: "in-treatment",
  },
  photo: String,
  otherHospitalIds: String,
  hospId: {
    type: String,
    default: () => `HOSP-${Date.now()}`, // auto-generate placeholder
  },
  referrerName: String,
  referrerEmail: String,
  referrerNumber: String,
  referrerType: String,
  medicalHistory: [String],
  emergencyContact: {
    name: String,
    phone: String,
    relation: String,
  },
  consents: [
    {
      type: mongoose.Schema.Types.Mixed,
    },
  ],
  documents: [
    {
      type: mongoose.Schema.Types.Mixed,
    },
  ],
});

patientSchema.pre("save", async function (next) {
  if (!this.username) {
    let unique = false;
    while (!unique) {
      const generatedUsername = `${this.name.first.substring(0.5)}_${Math.random()
        .toString(36)
        .substring(2, 3)}_${Date.now().toString().slice(-4)}`;
      const existingUser = await mongoose
        .model("User")
        .findOne({ username: generatedUsername });
      if (!existingUser) {
        this.username = generatedUsername;
        unique = true;
      }
    }
  }
  next();
});

module.exports = User.discriminator("patient", patientSchema);
