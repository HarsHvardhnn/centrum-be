// controllers/permanentDeleteController.js
const mongoose = require("mongoose");
const User = require("../models/user-entity/user");
const Patient = require("../models/user-entity/patient");
const Appointment = require("../models/appointment");
const Contact = require("../models/contact");
const PatientBill = require("../models/patientBill");
const PatientService = require("../models/patientServices");
const UserService = require("../models/userServices");
const { deleteFromCloudinary } = require("../utils/cloudinaryDelete");

/**
 * Permanently delete a patient or multiple patients
 * This will also delete related records (appointments, bills, services)
 */
exports.permanentlyDeletePatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { ids } = req.body; // Array of patient IDs for bulk delete

    // Bulk delete by multiple IDs
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Validate all IDs
      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      
      if (validIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid patient IDs provided"
        });
      }

      if (validIds.length !== ids.length) {
        return res.status(400).json({
          success: false,
          message: `Some IDs are invalid. ${ids.length - validIds.length} invalid ID(s) found`,
          validIds,
          invalidIds: ids.filter(id => !mongoose.Types.ObjectId.isValid(id))
        });
      }

      // Verify all are patients
      const patients = await User.find({ 
        _id: { $in: validIds }, 
        role: "patient" 
      });

      if (patients.length !== validIds.length) {
        return res.status(400).json({
          success: false,
          message: `Some IDs are not patients. Found ${patients.length} patient(s) out of ${validIds.length} ID(s)`
        });
      }

      // Get counts before deletion
      const appointmentsCount = await Appointment.countDocuments({ patient: { $in: validIds } });
      const billsCount = await PatientBill.countDocuments({ patient: { $in: validIds } });
      const patientServicesCount = await PatientService.countDocuments({ patient: { $in: validIds } });

      // Delete related records
      await Appointment.deleteMany({ patient: { $in: validIds } });
      await PatientBill.deleteMany({ patient: { $in: validIds } });
      await PatientService.deleteMany({ patient: { $in: validIds } });
      await UserService.deleteMany({ user: { $in: validIds }, userType: "patient" });

      // Delete patient profiles and photos
      const patientProfiles = await Patient.find({ _id: { $in: validIds } });
      for (const profile of patientProfiles) {
        if (profile.photo) {
          try {
            await deleteFromCloudinary(profile.photo);
          } catch (cloudError) {
            console.error("Error deleting patient photo from Cloudinary:", cloudError);
          }
        }
      }
      await Patient.deleteMany({ _id: { $in: validIds } });

      // Delete user accounts
      const deleteResult = await User.deleteMany({ _id: { $in: validIds }, role: "patient" });

      return res.status(200).json({
        success: true,
        message: `Permanently deleted ${deleteResult.deletedCount} patient(s) and all related records`,
        deletedRecords: {
          patients: deleteResult.deletedCount,
          appointments: appointmentsCount,
          bills: billsCount,
          patientServices: patientServicesCount
        },
        requestedCount: ids.length
      });
    }

    // Single patient delete (existing logic)
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid patient ID format"
      });
    }

    // Find patient
    const patient = await User.findOne({ 
      _id: patientId, 
      role: "patient" 
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }

    // Check for related records
    const appointmentsCount = await Appointment.countDocuments({ patient: patientId });
    const billsCount = await PatientBill.countDocuments({ patient: patientId });
    const patientServicesCount = await PatientService.countDocuments({ patient: patientId });

    // Delete related records
    // 1. Delete appointments
    await Appointment.deleteMany({ patient: patientId });

    // 2. Delete patient bills
    await PatientBill.deleteMany({ patient: patientId });

    // 3. Delete patient services
    await PatientService.deleteMany({ patient: patientId });

    // 4. Delete user services related to this patient
    await UserService.deleteMany({ user: patientId, userType: "patient" });

    // 5. Delete patient profile if exists
    const patientProfile = await Patient.findOne({ _id: patientId });
    if (patientProfile) {
      // Delete profile picture from Cloudinary if exists
      if (patientProfile.photo) {
        try {
          await deleteFromCloudinary(patientProfile.photo);
        } catch (cloudError) {
          console.error("Error deleting patient photo from Cloudinary:", cloudError);
        }
      }
      await Patient.deleteOne({ _id: patientId });
    }

    // 6. Delete user account
    await User.deleteOne({ _id: patientId });

    return res.status(200).json({
      success: true,
      message: "Patient and all related records permanently deleted",
      deletedRecords: {
        patient: 1,
        appointments: appointmentsCount,
        bills: billsCount,
        patientServices: patientServicesCount
      }
    });
  } catch (error) {
    console.error("Error permanently deleting patient:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to permanently delete patient",
      error: error.message
    });
  }
};

/**
 * Permanently delete cancelled appointments
 * Can delete single appointment, bulk delete by status, or bulk delete by IDs
 */
exports.permanentlyDeleteAppointments = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status, bulk } = req.query;
    const { ids } = req.body; // Array of appointment IDs for bulk delete by IDs

    // Bulk delete by multiple IDs
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Validate all IDs
      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      
      if (validIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid appointment IDs provided"
        });
      }

      if (validIds.length !== ids.length) {
        return res.status(400).json({
          success: false,
          message: `Some IDs are invalid. ${ids.length - validIds.length} invalid ID(s) found`,
          validIds,
          invalidIds: ids.filter(id => !mongoose.Types.ObjectId.isValid(id))
        });
      }

      // Find appointments to get their reports for Cloudinary cleanup
      const appointments = await Appointment.find({ _id: { $in: validIds } });
      
      // Delete reports from Cloudinary
      for (const appointment of appointments) {
        if (appointment.reports && appointment.reports.length > 0) {
          for (const report of appointment.reports) {
            if (report.metadata?.cloudinaryId) {
              try {
                await deleteFromCloudinary(report.metadata.cloudinaryId);
              } catch (cloudError) {
                console.error("Error deleting report from Cloudinary:", cloudError);
              }
            }
          }
        }
      }

      // Delete related bills
      await PatientBill.deleteMany({ appointment: { $in: validIds } });

      // Delete appointments
      const deleteResult = await Appointment.deleteMany({ _id: { $in: validIds } });

      return res.status(200).json({
        success: true,
        message: `Permanently deleted ${deleteResult.deletedCount} appointment(s)`,
        deletedCount: deleteResult.deletedCount,
        requestedCount: ids.length
      });
    } else if (bulk === "true" && status) {
      // Bulk delete appointments by status
      if (!["cancelled", "completed"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Bulk delete only allowed for 'cancelled' or 'completed' appointments"
        });
      }

      const appointments = await Appointment.find({ status });
      const count = appointments.length;

      // Delete related bills
      const appointmentIds = appointments.map(a => a._id);
      await PatientBill.deleteMany({ appointment: { $in: appointmentIds } });

      // Delete appointments
      await Appointment.deleteMany({ status });

      return res.status(200).json({
        success: true,
        message: `Permanently deleted ${count} ${status} appointment(s)`,
        deletedCount: count
      });
    } else if (appointmentId) {
      // Delete single appointment
      if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment ID format"
        });
      }

      const appointment = await Appointment.findById(appointmentId);

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found"
        });
      }

      // Delete related bill if exists
      await PatientBill.deleteMany({ appointment: appointmentId });

      // Delete appointment reports from Cloudinary if any
      if (appointment.reports && appointment.reports.length > 0) {
        for (const report of appointment.reports) {
          if (report.metadata?.cloudinaryId) {
            try {
              await deleteFromCloudinary(report.metadata.cloudinaryId);
            } catch (cloudError) {
              console.error("Error deleting report from Cloudinary:", cloudError);
            }
          }
        }
      }

      // Delete appointment
      await Appointment.deleteOne({ _id: appointmentId });

      return res.status(200).json({
        success: true,
        message: "Appointment permanently deleted"
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Either appointmentId or bulk=true with status parameter required"
      });
    }
  } catch (error) {
    console.error("Error permanently deleting appointments:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to permanently delete appointments",
      error: error.message
    });
  }
};

/**
 * Permanently delete contact messages
 * Can delete single message, bulk delete all soft-deleted, or bulk delete by IDs
 */
exports.permanentlyDeleteContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    const { bulk } = req.query;
    const { ids } = req.body; // Array of contact IDs for bulk delete by IDs

    // Bulk delete by multiple IDs
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Validate all IDs
      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      
      if (validIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid contact IDs provided"
        });
      }

      if (validIds.length !== ids.length) {
        return res.status(400).json({
          success: false,
          message: `Some IDs are invalid. ${ids.length - validIds.length} invalid ID(s) found`,
          validIds,
          invalidIds: ids.filter(id => !mongoose.Types.ObjectId.isValid(id))
        });
      }

      // Delete contacts
      const deleteResult = await Contact.deleteMany({ _id: { $in: validIds } });

      return res.status(200).json({
        success: true,
        message: `Permanently deleted ${deleteResult.deletedCount} contact message(s)`,
        deletedCount: deleteResult.deletedCount,
        requestedCount: ids.length
      });
    } else if (bulk === "true") {
      // Bulk delete all soft-deleted contacts
      const result = await Contact.deleteMany({ isDeleted: true });
      
      return res.status(200).json({
        success: true,
        message: `Permanently deleted ${result.deletedCount} contact message(s)`,
        deletedCount: result.deletedCount
      });
    } else if (contactId) {
      // Delete single contact
      if (!mongoose.Types.ObjectId.isValid(contactId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid contact ID format"
        });
      }

      const contact = await Contact.findById(contactId);

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: "Contact message not found"
        });
      }

      await Contact.deleteOne({ _id: contactId });

      return res.status(200).json({
        success: true,
        message: "Contact message permanently deleted"
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Either contactId or bulk=true parameter required"
      });
    }
  } catch (error) {
    console.error("Error permanently deleting contact:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to permanently delete contact",
      error: error.message
    });
  }
};

/**
 * Permanently delete user account
 * This will also delete related records
 * Can delete single user or bulk delete by IDs
 */
exports.permanentlyDeleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { ids } = req.body; // Array of user IDs for bulk delete

    // Bulk delete by multiple IDs
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Validate all IDs
      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      
      if (validIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid user IDs provided"
        });
      }

      if (validIds.length !== ids.length) {
        return res.status(400).json({
          success: false,
          message: `Some IDs are invalid. ${ids.length - validIds.length} invalid ID(s) found`,
          validIds,
          invalidIds: ids.filter(id => !mongoose.Types.ObjectId.isValid(id))
        });
      }

      // Find all users (including admins to check)
      const allUsers = await User.find({ _id: { $in: validIds } });

      if (allUsers.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No users found with the provided IDs"
        });
      }

      // Check for admin users
      const adminUsers = allUsers.filter(u => u.role === "admin");
      if (adminUsers.length > 0) {
        return res.status(403).json({
          success: false,
          message: `Cannot delete admin users. ${adminUsers.length} admin user(s) found in the list`,
          adminIds: adminUsers.map(u => u._id.toString())
        });
      }

      // Filter out admins (should be none, but just in case)
      const users = allUsers.filter(u => u.role !== "admin");

      // Group users by role for efficient deletion
      const patients = users.filter(u => u.role === "patient");
      const doctors = users.filter(u => u.role === "doctor");
      const receptionists = users.filter(u => u.role === "receptionist");

      let deletedRecords = {
        users: users.length,
        appointments: 0,
        bills: 0,
        services: 0
      };

      // Delete patient-related records
      if (patients.length > 0) {
        const patientIds = patients.map(p => p._id);
        deletedRecords.appointments += await Appointment.countDocuments({ patient: { $in: patientIds } });
        deletedRecords.bills += await PatientBill.countDocuments({ patient: { $in: patientIds } });
        deletedRecords.services += await PatientService.countDocuments({ patient: { $in: patientIds } });

        await Appointment.deleteMany({ patient: { $in: patientIds } });
        await PatientBill.deleteMany({ patient: { $in: patientIds } });
        await PatientService.deleteMany({ patient: { $in: patientIds } });
        await UserService.deleteMany({ user: { $in: patientIds }, userType: "patient" });

        // Delete patient profiles and photos
        const patientProfiles = await Patient.find({ _id: { $in: patientIds } });
        for (const profile of patientProfiles) {
          if (profile.photo) {
            try {
              await deleteFromCloudinary(profile.photo);
            } catch (cloudError) {
              console.error("Error deleting patient photo from Cloudinary:", cloudError);
            }
          }
        }
        await Patient.deleteMany({ _id: { $in: patientIds } });
      }

      // Delete doctor-related records
      if (doctors.length > 0) {
        const doctorIds = doctors.map(d => d._id);
        deletedRecords.appointments += await Appointment.countDocuments({ doctor: { $in: doctorIds } });
        await Appointment.deleteMany({ doctor: { $in: doctorIds } });
        await UserService.deleteMany({ user: { $in: doctorIds }, userType: "doctor" });
      }

      // Delete receptionist-related records (bills they created)
      if (receptionists.length > 0) {
        const receptionistIds = receptionists.map(r => r._id);
        deletedRecords.bills += await PatientBill.countDocuments({ billedBy: { $in: receptionistIds } });
        await PatientBill.updateMany(
          { billedBy: { $in: receptionistIds } },
          { $unset: { billedBy: "" } }
        );
      }

      // Delete user accounts
      const userIdsToDelete = users.map(u => u._id);
      const deleteResult = await User.deleteMany({ _id: { $in: userIdsToDelete } });

      return res.status(200).json({
        success: true,
        message: `Permanently deleted ${deleteResult.deletedCount} user(s) and all related records`,
        deletedRecords,
        requestedCount: ids.length
      });
    }

    // Single user delete (existing logic)
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Find user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Prevent deleting admin users (safety check)
    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot permanently delete admin users"
      });
    }

    // Check for related records
    let deletedRecords = {
      user: 1,
      appointments: 0,
      bills: 0,
      services: 0
    };

    // Delete based on user role
    if (user.role === "patient") {
      // Delete patient-related records
      deletedRecords.appointments = await Appointment.countDocuments({ patient: userId });
      deletedRecords.bills = await PatientBill.countDocuments({ patient: userId });
      deletedRecords.services = await PatientService.countDocuments({ patient: userId });

      await Appointment.deleteMany({ patient: userId });
      await PatientBill.deleteMany({ patient: userId });
      await PatientService.deleteMany({ patient: userId });
      await UserService.deleteMany({ user: userId, userType: "patient" });

      // Delete patient profile
      const patientProfile = await Patient.findOne({ _id: userId });
      if (patientProfile) {
        if (patientProfile.photo) {
          try {
            await deleteFromCloudinary(patientProfile.photo);
          } catch (cloudError) {
            console.error("Error deleting patient photo:", cloudError);
          }
        }
        await Patient.deleteOne({ _id: userId });
      }
    } else if (user.role === "doctor") {
      // Delete doctor-related records
      deletedRecords.appointments = await Appointment.countDocuments({ doctor: userId });
      await Appointment.deleteMany({ doctor: userId });
      await UserService.deleteMany({ user: userId, userType: "doctor" });
    } else if (user.role === "receptionist") {
      // Delete receptionist-related records (bills they created)
      deletedRecords.bills = await PatientBill.countDocuments({ billedBy: userId });
      await PatientBill.updateMany(
        { billedBy: userId },
        { $unset: { billedBy: "" } }
      );
    }

    // Delete user account
    await User.deleteOne({ _id: userId });

    return res.status(200).json({
      success: true,
      message: "User account and related records permanently deleted",
      deletedRecords
    });
  } catch (error) {
    console.error("Error permanently deleting user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to permanently delete user",
      error: error.message
    });
  }
};

/**
 * Permanently delete invoice/bill
 * Can delete single invoice, bulk delete by IDs, or bulk delete by status
 */
exports.permanentlyDeleteInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { bulk, status } = req.query;
    const { ids } = req.body; // Array of invoice IDs for bulk delete by IDs

    // Bulk delete by multiple IDs
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Validate all IDs
      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      
      if (validIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid invoice IDs provided"
        });
      }

      if (validIds.length !== ids.length) {
        return res.status(400).json({
          success: false,
          message: `Some IDs are invalid. ${ids.length - validIds.length} invalid ID(s) found`,
          validIds,
          invalidIds: ids.filter(id => !mongoose.Types.ObjectId.isValid(id))
        });
      }

      // Find invoices to get their URLs for Cloudinary cleanup
      const bills = await PatientBill.find({ _id: { $in: validIds } });

      if (bills.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No invoices found with the provided IDs"
        });
      }

      // Delete invoice PDFs from Cloudinary if any
      for (const bill of bills) {
        if (bill.invoiceUrl) {
          try {
            // Extract public ID from Cloudinary URL if possible
            const urlParts = bill.invoiceUrl.split('/');
            const publicId = urlParts[urlParts.length - 1].split('.')[0];
            await deleteFromCloudinary(publicId);
          } catch (cloudError) {
            console.error("Error deleting invoice from Cloudinary:", cloudError);
          }
        }
      }

      // Delete invoices
      const deleteResult = await PatientBill.deleteMany({ _id: { $in: validIds } });

      return res.status(200).json({
        success: true,
        message: `Permanently deleted ${deleteResult.deletedCount} invoice(s)`,
        deletedCount: deleteResult.deletedCount,
        requestedCount: ids.length
      });
    } else if (bulk === "true" && status) {
      // Bulk delete invoices by payment status
      if (!["cancelled", "paid"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Bulk delete only allowed for 'cancelled' or 'paid' invoices"
        });
      }

      const bills = await PatientBill.find({ paymentStatus: status });
      const count = bills.length;

      // Delete invoice PDFs from Cloudinary if any
      for (const bill of bills) {
        if (bill.invoiceUrl) {
          try {
            // Extract public ID from Cloudinary URL if possible
            const urlParts = bill.invoiceUrl.split('/');
            const publicId = urlParts[urlParts.length - 1].split('.')[0];
            await deleteFromCloudinary(publicId);
          } catch (cloudError) {
            console.error("Error deleting invoice from Cloudinary:", cloudError);
          }
        }
      }

      await PatientBill.deleteMany({ paymentStatus: status });

      return res.status(200).json({
        success: true,
        message: `Permanently deleted ${count} ${status} invoice(s)`,
        deletedCount: count
      });
    } else if (invoiceId) {
      // Delete single invoice
      if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid invoice ID format"
        });
      }

      const bill = await PatientBill.findById(invoiceId);

      if (!bill) {
        return res.status(404).json({
          success: false,
          message: "Invoice not found"
        });
      }

      // Delete invoice PDF from Cloudinary if exists
      if (bill.invoiceUrl) {
        try {
          const urlParts = bill.invoiceUrl.split('/');
          const publicId = urlParts[urlParts.length - 1].split('.')[0];
          await deleteFromCloudinary(publicId);
        } catch (cloudError) {
          console.error("Error deleting invoice from Cloudinary:", cloudError);
        }
      }

      await PatientBill.deleteOne({ _id: invoiceId });

      return res.status(200).json({
        success: true,
        message: "Invoice permanently deleted"
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Either invoiceId or bulk=true with status parameter required"
      });
    }
  } catch (error) {
    console.error("Error permanently deleting invoice:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to permanently delete invoice",
      error: error.message
    });
  }
};

/**
 * Get statistics about deletable records
 * Helps admin understand what can be deleted
 */
exports.getDeletionStats = async (req, res) => {
  try {
    const stats = {
      cancelledAppointments: await Appointment.countDocuments({ status: "cancelled" }),
      completedAppointments: await Appointment.countDocuments({ status: "completed" }),
      softDeletedContacts: await Contact.countDocuments({ isDeleted: true }),
      cancelledInvoices: await PatientBill.countDocuments({ paymentStatus: "cancelled" }),
      paidInvoices: await PatientBill.countDocuments({ paymentStatus: "paid" }),
      softDeletedUsers: await User.countDocuments({ deleted: true, role: { $ne: "admin" } })
    };

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Error getting deletion stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get deletion statistics",
      error: error.message
    });
  }
};













