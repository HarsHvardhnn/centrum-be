const PatientService = require("../models/patientServices");
const Service = require("../models/services");
const User = require("../models/user-entity/user");

// Add services to a patient
// This will append new services to existing ones
exports.addServicesToPatient = async (req, res) => {
  try {
    const { patientId, services } = req.body;
    
    if (!patientId || !services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ 
        message: "Patient ID and at least one service are required" 
      });
    }

    // Verify patient exists and is a patient
    const patient = await User.findOne({  patientId, role: "patient" });
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
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
    let patientService = await PatientService.findOne({ 
      patient: patient._id,
      isDeleted: false
    });
    
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
        services: formattedServices,
        assignedBy: req.user.id,
        isDeleted: false
      });
    }

    await patientService.populate([
      { path: "patient", select: "name email" },
      { path: "services.service", select: "title shortDescription price" },
      { path: "assignedBy", select: "name email" }
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

    // Verify patient exists
    console.log(patientId);
    const patient = await User.findOne({ patientId, role: "patient" });
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const patientServices = await PatientService.findOne({ 
      patient: patient._id,
      isDeleted: false
    }).populate([
      { path: "patient", select: "name email" },
      { path: "services.service", select: "title shortDescription price icon images" },
      { path: "assignedBy", select: "name email" }
    ]);

    if (!patientServices) {
      return res.status(200).json({
        message: "No services found for this patient",
        data: { patient: patientId, services: [] }
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
    const { status, notes } = req.body;

    // Verify patient exists
    const patient = await User.findOne({ patientId, role: "patient" });
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Find patient service record
    const patientService = await PatientService.findOne({ 
      patient: patient._id,
      isDeleted: false
    });

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
      { path: "assignedBy", select: "name email" }
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

    // Verify patient exists
    const patient = await User.findOne({ patientId, role: "patient" });
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Find and mark as deleted
    const result = await PatientService.findOneAndUpdate(
      { patient: patient._id },
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

    console.log("service id",serviceId);
    // Verify patient exists
    const patient = await User.findOne({  patientId, role: "patient" });
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Find patient service record
    const patientService = await PatientService.findOne({ 
      patient: patient._id,
      isDeleted: false
    });

    if (!patientService) {
      return res.status(404).json({ message: "Patient services not found" });
    }

    console.log(patientService);
    // Find and remove the specific service
    const initialLength = patientService.services.length;
    patientService.services = patientService.services.filter(
      s => s.service.toString() !== serviceId
    );


    console.log("initial",initialLength);
    if (patientService.services.length === initialLength) {
      return res.status(404).json({ message: "Service not found for this patient" });
    }

    await patientService.save();

    await patientService.populate([
      { path: "patient", select: "name email" },
      { path: "services.service", select: "title shortDescription price" },
      { path: "assignedBy", select: "name email" }
    ]);

    return res.status(200).json({
      message: "Service removed successfully",
      data: patientService
    });
  } catch (error) {
    console.error("Error removing service from patient:", error);
    return res.status(500).json({ 
      message: "Failed to remove service from patient",
      error: error.message
    });
  }
}; 