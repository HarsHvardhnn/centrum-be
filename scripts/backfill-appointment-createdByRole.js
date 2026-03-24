const mongoose = require("mongoose");
const Appointment = require("../models/appointment");
require("dotenv").config();

/**
 * Backfill createdByRole for existing appointments that don't have it.
 * Uses existing createdBy and booking_source to infer:
 * - booking_source "ONLINE" or createdBy "online" → createdByRole = null
 * - createdBy "receptionist" → createdByRole = "receptionist"
 * - createdBy "doctor" → createdByRole = "doctor"
 * - createdBy "admin" → createdByRole = "admin"
 */
async function backfillCreatedByRole() {
  try {
    console.log("Starting backfill of createdByRole for existing appointments...");

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to database");

    const appointments = await Appointment.find({
      $or: [
        { createdByRole: { $exists: false } },
        { createdByRole: null },
      ],
    }).lean();

    console.log(`Found ${appointments.length} appointments without createdByRole`);

    if (appointments.length === 0) {
      console.log("All appointments already have createdByRole.");
      return;
    }

    let updated = 0;
    let skipped = 0;

    for (const apt of appointments) {
      let createdByRole = null;
      const createdBy = apt.createdBy;
      const bookingSource = apt.booking_source;

      if (bookingSource === "ONLINE" || createdBy === "online") {
        createdByRole = null;
      } else if (createdBy === "receptionist") {
        createdByRole = "receptionist";
      } else if (createdBy === "doctor") {
        createdByRole = "doctor";
      } else if (createdBy === "admin") {
        createdByRole = "admin";
      } else {
        createdByRole = null;
        skipped++;
      }

      await Appointment.updateOne(
        { _id: apt._id },
        { $set: { createdByRole } }
      );
      updated++;
    }

    console.log(`Updated ${updated} appointments with createdByRole.`);
    if (skipped > 0) {
      console.log(`Skipped (unknown createdBy) ${skipped} appointments.`);
    }
    console.log("Backfill completed.");
  } catch (error) {
    console.error("Backfill error:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from database.");
  }
}

backfillCreatedByRole()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
