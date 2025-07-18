const UserService = require("../models/userServices");

/**
 * Updates the price of a specific service in all related userServices
 * @param {string} serviceId - The ID of the service being updated
 * @param {number} newPrice - The new price to set
 */
const updateServicePricesInRelatedModels = async (serviceId, newPrice) => {
  try {
    // Update prices in userServices
    const userServicesToUpdate = await UserService.find({
      "services.service": serviceId,
      isDeleted: false
    });

    for (const userService of userServicesToUpdate) {
      // Update the price for the specific service in the services array
      userService.services = userService.services.map(serviceItem => {
        if (serviceItem.service.toString() === serviceId) {
          return {
            ...serviceItem.toObject(),
            price: newPrice,
            isCustomPrice: false // Reset to false since we're updating from main service
          };
        }
        return serviceItem;
      });
      
      await userService.save();
    }

    console.log(`Updated prices for service ${serviceId} in ${userServicesToUpdate.length} userServices`);
  } catch (error) {
    console.error('Error updating service prices in related models:', error);
    throw error;
  }
};

module.exports = { updateServicePricesInRelatedModels }; 