/**
 * Patient Portal – Login / Create account flow (to be enabled later).
 * Rule: A patient account cannot be created if the patient has never visited the clinic.
 * These APIs support the flow where the patient enters PESEL, system checks PATIENT_ID and visit,
 * then either allows associating email and sending login details or returns "No patient account found".
 */

const bcrypt = require("bcrypt");
const crypto = require("crypto");
const patient = require("../models/user-entity/patient");
const User = require("../models/user-entity/user");
const Appointment = require("../models/appointment");
const { validatePesel } = require("../utils/peselValidation");
const sendWelcomeEmail = require("../utils/welcomeEmail");

const NO_ACCOUNT_MESSAGE =
  "No patient account found - please contact the reception desk.";

function normalizePesel(raw) {
  if (!raw) return "";
  return String(raw).replace(/\D/g, "").trim();
}

function generateTemporaryPassword() {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * Check by PESEL: does a patient exist and have at least one visit?
 * Used when patient clicks "Log in or Create account" and enters PESEL.
 *
 * POST /api/patient-portal/check-by-pesel
 * Body: { pesel: string }
 *
 * Success (patient exists and has visited): 200 { success: true, found: true, patientId, message }
 * Not found / no visit: 404 { success: false, found: false, message: "No patient account found - please contact the reception desk." }
 */
exports.checkByPesel = async (req, res) => {
  try {
    const rawPesel = req.body?.pesel ?? req.query?.pesel;
    const pesel = normalizePesel(rawPesel);

    if (!pesel || pesel.length !== 11) {
      return res.status(400).json({
        success: false,
        message: "Podaj prawidłowy numer PESEL (11 cyfr).",
      });
    }

    const validation = validatePesel(pesel);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.warning || "Nieprawidłowy format PESEL (11 cyfr).",
      });
    }

    const patientDoc = await patient
      .findOne({ govtId: pesel, deleted: { $ne: true } })
      .lean();

    if (!patientDoc) {
      return res.status(404).json({
        success: false,
        found: false,
        message: NO_ACCOUNT_MESSAGE,
      });
    }

    const visitCount = await Appointment.countDocuments({
      patient: patientDoc._id,
    });

    if (visitCount < 1) {
      return res.status(404).json({
        success: false,
        found: false,
        message: NO_ACCOUNT_MESSAGE,
      });
    }

    return res.status(200).json({
      success: true,
      found: true,
      patientId: patientDoc.patientId || patientDoc._id.toString(),
      message: "Patient found and has visited the clinic. You can proceed to associate an email and receive login details.",
    });
  } catch (error) {
    console.error("Patient portal checkByPesel error:", error);
    return res.status(500).json({
      success: false,
      message: "Błąd wewnętrzny serwera.",
    });
  }
};

/**
 * Create account / request login details: associate email with patient and send temporary password.
 * Call after checkByPesel returns found: true. Patient must exist and have at least one visit (re-validated).
 *
 * POST /api/patient-portal/create-account
 * Body: { pesel: string, email: string }
 *
 * Success: 200 { success: true, message: "Login details have been sent to your email." }
 * Email already used by another account: 409
 * Patient not found / no visit: 404 with NO_ACCOUNT_MESSAGE
 */
exports.createAccount = async (req, res) => {
  try {
    const rawPesel = req.body?.pesel;
    const email = req.body?.email && String(req.body.email).trim().toLowerCase();

    const pesel = normalizePesel(rawPesel);

    if (!pesel || pesel.length !== 11) {
      return res.status(400).json({
        success: false,
        message: "Podaj prawidłowy numer PESEL (11 cyfr).",
      });
    }

    const validation = validatePesel(pesel);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.warning || "Nieprawidłowy format PESEL (11 cyfr).",
      });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Podaj prawidłowy adres e-mail.",
      });
    }

    const patientDoc = await patient.findOne({
      govtId: pesel,
      deleted: { $ne: true },
    });

    if (!patientDoc) {
      return res.status(404).json({
        success: false,
        found: false,
        message: NO_ACCOUNT_MESSAGE,
      });
    }

    const visitCount = await Appointment.countDocuments({
      patient: patientDoc._id,
    });

    if (visitCount < 1) {
      return res.status(404).json({
        success: false,
        found: false,
        message: NO_ACCOUNT_MESSAGE,
      });
    }

    // Patient already has an account (email + password set, e.g. from previous create-account or complete-registration)
    if (patientDoc.signupMethod === "email" && patientDoc.email && String(patientDoc.email).trim()) {
      return res.status(409).json({
        success: false,
        alreadyHasAccount: true,
        message: "Ten pacjent ma już konto. Zaloguj się przy użyciu adresu e-mail i hasła.",
      });
    }

    const existingUserWithEmail = await User.findOne({
      email,
      _id: { $ne: patientDoc._id },
      deleted: { $ne: true },
    }).lean();

    if (existingUserWithEmail) {
      return res.status(409).json({
        success: false,
        message:
          "Ten adres e-mail jest już przypisany do innego konta. Użyj innego adresu e-mail lub skontaktuj się z rejestracją.",
      });
    }

    const tempPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    patientDoc.email = email;
    patientDoc.password = hashedPassword;
    patientDoc.signupMethod = "email";
    await patientDoc.save();

    const userData = {
      name:
        patientDoc.name?.first && patientDoc.name?.last
          ? { first: patientDoc.name.first, last: patientDoc.name.last }
          : patientDoc.name,
      email: patientDoc.email,
      password: tempPassword,
    };

    sendWelcomeEmail(userData, "polish").catch((err) =>
      console.error("Patient portal welcome email failed:", err)
    );

    return res.status(200).json({
      success: true,
      message:
        "Dane logowania zostały wysłane na podany adres e-mail. Sprawdź skrzynkę (oraz folder spam).",
    });
  } catch (error) {
    console.error("Patient portal createAccount error:", error);
    return res.status(500).json({
      success: false,
      message: "Błąd wewnętrzny serwera.",
    });
  }
};
