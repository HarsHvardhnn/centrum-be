const PatientService = require("../models/patientServices");
const Service = require("../models/services");
const User = require("../models/user-entity/user");
const Appointment = require("../models/appointment");

// Add services to a patient
// This will append new services to existing ones
exports.addServicesToPatient = async (req, res) => {
  try {
    const { patientId, appointmentId, services } = req.body;
    
    if (!patientId || !services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ 
        message: "Patient ID and at least one service are required" 
      });
    }

    // Verify patient exists and is a patient
    const patient = await User.findOne({  _id:patientId, role: "patient" });
    console.log(patient,"patient");
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Verify appointment if provided
    let appointment = null;
    if (appointmentId) {
      appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // Validate that appointment belongs to the patient
      if (appointment.patient.toString() !== patientId) {
        return res.status(400).json({ message: "Appointment does not belong to this patient" });
      }
    }

    // Verify all services exist
    const serviceIds = services.map(s => s.serviceId);
    const existingServices = await Service.find({ 
      _id: { $in: serviceIds },
      isDeleted: false
    });

    if (existingServices.length !== serviceIds.length) {
      return res.status(400).json({ 
        message: "One or more services do not exist" 
      });
    }

    // Format service data
    const formattedServices = services.map(s => ({
      service: s.serviceId,
      notes: s.notes || "",
      status: s.status || "active",
      assignedDate: new Date(),
    }));

    // Find existing patient services or create new one
    let patientService = null;
    
    if (appointmentId) {
      // If appointment is provided, find by both patient and appointment
      patientService = await PatientService.findOne({ 
        patient: patient._id,
        appointment: appointmentId,
        isDeleted: false
      });
    } else {
      // Backward compatibility: find by patient only if no appointment ID
      patientService = await PatientService.findOne({ 
        patient: patient._id,
        appointment: { $exists: false },
        isDeleted: false
      });
    }
    
    if (patientService) {
      // Patient has existing services, append new ones
      // Check for duplicates first - don't add a service if it's already assigned
      const existingServiceIds = patientService.services.map(s => s.service.toString());
      
      // Filter out any services that are already assigned
      const newServicesToAdd = formattedServices.filter(s => 
        !existingServiceIds.includes(s.service.toString())
      );
      
      if (newServicesToAdd.length > 0) {
        // Append new services to existing ones
        patientService.services.push(...newServicesToAdd);
        patientService.assignedBy= req.user.id,
        await patientService.save();
      }
    } else {
      // Patient doesn't have services yet, create new document
      patientService = await PatientService.create({
        patient: patient._id,
        appointment: appointmentId || undefined,
        services: formattedServices,
        assignedBy: req.user.id,
        isDeleted: false
      });
    }

    await patientService.populate([
      { path: "patient", select: "name email" },
      { path: "services.service", select: "title shortDescription price" },
      { path: "assignedBy", select: "name email" },
      { path: "appointment", select: "date startTime" }
    ]);

    return res.status(200).json({
      message: "Services added successfully",
      data: patientService
    });
  } catch (error) {
    console.error("Error adding services to patient:", error);
    return res.status(500).json({ 
      message: "Failed to add services to patient",
      error: error.message
    });
  }
};

// Get services for a patient
exports.getPatientServices = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { appointmentId } = req.query;

    // Verify patient exists
    console.log(patientId);
    const patient = await User.findOne({ _id:patientId, role: "patient" });
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Prepare filter
    const filter = { 
      patient: patient._id,
      isDeleted: false
    };

    // Add appointment filter if provided
    if (appointmentId) {
      filter.appointment = appointmentId;
    }

    const patientServices = await PatientService.findOne(filter).populate([
      { path: "patient", select: "name email" },
      { path: "services.service", select: "title shortDescription price icon images" },
      { path: "assignedBy", select: "name email" },
      { path: "appointment", select: "date startTime" }
    ]);

    if (!patientServices) {
      return res.status(200).json({
        message: "No services found for this patient",
        data: { 
          patient: patientId, 
          appointment: appointmentId || null,
          services: [] 
        }
      });
    }

    return res.status(200).json({
      message: "Patient services retrieved successfully",
      data: patientServices
    });
  } catch (error) {
    console.error("Error retrieving patient services:", error);
    return res.status(500).json({ 
      message: "Failed to retrieve patient services",
      error: error.message
    });
  }
};

// Update a specific service for a patient
exports.updatePatientService = async (req, res) => {
  try {
    const { patientId, serviceId } = req.params;
    const { appointmentId } = req.query;
    const { status, notes } = req.body;

    // Verify patient exists
    const patient = await User.findOne({ _id:patientId, role: "patient" });
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Prepare filter
    const filter = { 
      patient: patient._id,
      isDeleted: false
    };

    // Add appointment filter if provided
    if (appointmentId) {
      filter.appointment = appointmentId;
    }

    // Find patient service record
    const patientService = await PatientService.findOne(filter);

    if (!patientService) {
      return res.status(404).json({ message: "Patient services not found" });
    }

    // Find the specific service in the services array
    const serviceIndex = patientService.services.findIndex(
      s => s.service.toString() === serviceId
    );

    if (serviceIndex === -1) {
      return res.status(404).json({ message: "Service not found for this patient" });
    }

    // Update the service
    if (status) patientService.services[serviceIndex].status = status;
    if (notes) patientService.services[serviceIndex].notes = notes;
    
    // If status is completed, set completedDate
    if (status === "completed") {
      patientService.services[serviceIndex].completedDate = new Date();
    }

    await patientService.save();

    await patientService.populate([
      { path: "patient", select: "name email" },
      { path: "services.service", select: "title shortDescription price" },
      { path: "assignedBy", select: "name email" },
      { path: "appointment", select: "date startTime" }
    ]);

    return res.status(200).json({
      message: "Patient service updated successfully",
      data: patientService
    });
  } catch (error) {
    console.error("Error updating patient service:", error);
    return res.status(500).json({ 
      message: "Failed to update patient service",
      error: error.message
    });
  }
};

// Delete all services for a patient (soft delete)
exports.deletePatientServices = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { appointmentId } = req.query;

    // Verify patient exists
    const patient = await User.findOne({ _id:patientId, role: "patient" });
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Prepare filter
    const filter = { patient: patient._id };
    
    // Add appointment filter if provided
    if (appointmentId) {
      filter.appointment = appointmentId;
    }

    // Find and mark as deleted
    const result = await PatientService.findOneAndUpdate(
      filter,
      { isDeleted: true },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: "Patient services not found" });
    }

    return res.status(200).json({
      message: "Patient services deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting patient services:", error);
    return res.status(500).json({ 
      message: "Failed to delete patient services",
      error: error.message
    });
  }
};

// Remove a specific service from a patient
exports.removeServiceFromPatient = async (req, res) => {
  try {
    const { patientId, serviceId } = req.params;
    const { appointmentId } = req.query;

    console.log("service id", serviceId);
    // Verify patient exists
    const patient = await User.findOne({ _id:patientId, role: "patient" });
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Prepare filter
    const filter = { 
      patient: patient._id,
      isDeleted: false
    };

    // Add appointment filter if provided
    if (appointmentId) {
      filter.appointment = appointmentId;
    }

    // Find patient service record
    const patientService = await PatientService.findOne(filter);

    if (!patientService) {
      return res.status(404).json({ message: "Patient services not found" });
    }

    // Find the specific service in the services array
    const serviceIndex = patientService.services.findIndex(
      s => s.service.toString() === serviceId
    );

    if (serviceIndex === -1) {
      return res.status(404).json({ message: "Service not found for this patient" });
    }

    // Remove the service
    patientService.services.splice(serviceIndex, 1);
    await patientService.save();

    return res.status(200).json({
      message: "Service removed successfully"
    });
  } catch (error) {
    console.error("Error removing service from patient:", error);
    return res.status(500).json({ 
      message: "Failed to remove service",
      error: error.message
    });
  }
}; 