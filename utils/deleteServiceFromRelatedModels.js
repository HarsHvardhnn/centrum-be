const UserService = require("../models/userServices");
const PatientService = require("../models/patientServices");
const PatientBill = require("../models/patientBill");

/**
 * Removes a service from all related models when the service is deleted
 * @param {string} serviceId - The ID of the service being deleted
 */
const deleteServiceFromRelatedModels = async (serviceId) => {
  try {
    // Remove service from userServices
    const userServicesToUpdate = await UserService.find({
      "services.service": serviceId,
      isDeleted: false
    });

    for (const userService of userServicesToUpdate) {
      // Remove the service from the services array
      userService.services = userService.services.filter(
        serviceItem => serviceItem.service.toString() !== serviceId
      );
      
      // If no services left, mark as deleted
      if (userService.services.length === 0) {
        userService.isDeleted = true;
        userService.updatedAt = new Date();
      }
      
      await userService.save();
    }

    // Remove service from patientServices
    const patientServicesToUpdate = await PatientService.find({
      "services.service": serviceId,
      isDeleted: false
    });

    for (const patientService of patientServicesToUpdate) {
      // Remove the service from the services array
      patientService.services = patientService.services.filter(
        serviceItem => serviceItem.service.toString() !== serviceId
      );
      
      // If no services left, mark as deleted
      if (patientService.services.length === 0) {
        patientService.isDeleted = true;
        patientService.updatedAt = new Date();
      }
      
      await patientService.save();
    }

    // Remove service from patientBills
    const patientBillsToUpdate = await PatientBill.find({
      "services.serviceId": serviceId,
      isDeleted: false
    });

    for (const patientBill of patientBillsToUpdate) {
      // Remove the service from the services array
      patientBill.services = patientBill.services.filter(
        serviceItem => serviceItem.serviceId.toString() !== serviceId
      );
      
      // If no services left, mark as deleted
      if (patientBill.services.length === 0) {
        patientBill.isDeleted = true;
        patientBill.updatedAt = new Date();
      } else {
        // Recalculate totals if services remain
        const subtotal = patientBill.services.reduce((sum, service) => 
          sum + parseFloat(service.price || 0), 0
        );
        patientBill.subtotal = subtotal;
        
        const taxAmount = (subtotal * patientBill.taxPercentage) / 100;
        patientBill.taxAmount = taxAmount;
        
        const totalAmount = subtotal + taxAmount + patientBill.additionalCharges - patientBill.discount;
        patientBill.totalAmount = totalAmount.toString();
        patientBill.updatedAt = new Date();
      }
      
      await patientBill.save();
    }

    console.log(`Removed service ${serviceId} from related models:`);
    console.log(`- Updated ${userServicesToUpdate.length} userServices`);
    console.log(`- Updated ${patientServicesToUpdate.length} patientServices`);
    console.log(`- Updated ${patientBillsToUpdate.length} patientBills`);
  } catch (error) {
    console.error('Error removing service from related models:', error);
    throw error;
  }
};

module.exports = { deleteServiceFromRelatedModels };
