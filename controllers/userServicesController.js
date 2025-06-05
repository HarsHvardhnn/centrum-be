const UserService = require("../models/userServices");
const Service = require("../models/services");
const User = require("../models/user-entity/user");

// Common function to validate user by type
const validateUser = async (userId, userType) => {
  const user = await User.findOne({ _id: userId, role: userType });
  if (!user) {
    return { valid: false, message: `${userType.charAt(0).toUpperCase() + userType.slice(1)} not found` };
  }
  return { valid: true, user };
};

// Add services to a user (patient or doctor)
exports.addServicesToUser = async (req, res) => {
  try {
    const { userId, userType, services } = req.body;
    
    if (!userId || !userType || !services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ 
        message: "Użytkownik ID, typ użytkownika i co najmniej jedna usługa są wymagane" 
      });
    }

    if (!["patient", "doctor"].includes(userType)) {
      return res.status(400).json({ 
        message: "Typ użytkownika musi być albo 'pacjent' albo 'lekarz'" 
      });
    }

    // Verify user exists with the specified role
    const userValidation = await validateUser(userId, userType);
    if (!userValidation.valid) {
      return res.status(404).json({ message: userValidation.message });
    }

    // Verify all services exist
    const serviceIds = services.map(s => s.serviceId);
    const existingServices = await Service.find({ 
      _id: { $in: serviceIds },
      isDeleted: false
    });

    if (existingServices.length !== serviceIds.length) {
      return res.status(400).json({ 
        message: "Jedna lub więcej usług nie istnieje" 
      });
    }

    // Format service data
    const formattedServices = services.map(s => {
      // Find the service to get its default price
      const serviceInfo = existingServices.find(es => es._id.toString() === s.serviceId);
      const defaultPrice = serviceInfo?.price || 0;
      
      return {
        service: s.serviceId,
        notes: s.notes || "",
        status: s.status || "active",
        price: s.price !== undefined ? s.price : defaultPrice,
        isCustomPrice: s.price !== undefined,
        assignedDate: new Date(),
      };
    });

    // Find existing user services or create new one
    let userService = await UserService.findOne({ 
      user: userId, 
      userType,
      isDeleted: false 
    });
    
    if (userService) {
      // User has existing services, append new ones
      // Check for duplicates first - don't add a service if it's already assigned
      const existingServiceIds = userService.services.map(s => s.service.toString());
      
      // Filter out any services that are already assigned
      const newServicesToAdd = formattedServices.filter(s => 
        !existingServiceIds.includes(s.service.toString())
      );
      
      if (newServicesToAdd.length > 0) {
        // Append new services to existing ones
        userService.services.push(...newServicesToAdd);
        await userService.save();
      }
    } else {
      // User doesn't have services yet, create new document
      userService = await UserService.create({
        user: userId,
        userType,
        services: formattedServices,
        assignedBy: req.user.id,
        isDeleted: false
      });
    }

    await userService.populate([
      { path: "user", select: "name email role" },
      { path: "services.service", select: "title shortDescription price icon images" },
      { path: "assignedBy", select: "name email" }
    ]);

    return res.status(200).json({
      message: `Usługi dodane pomyślnie do ${userType}`,
      data: userService
    });
  } catch (error) {
    // console.error(`Error adding services to ${req.body.userType || 'user'}:`, error);
    return res.status(500).json({ 
      message: `Nie udało się dodać usług do ${req.body.userType || 'użytkownika'}`,
      error: error.message
    });
  }
};

// Get services for a user (patient or doctor)
exports.getUserServices = async (req, res) => {
  try {
    const { userId, userType } = req.params;

    if (!userType || !["patient", "doctor"].includes(userType)) {
      return res.status(400).json({ 
        message: "Typ użytkownika musi być albo 'pacjent' albo 'lekarz'" 
      });
    }

    // Verify user exists with the specified role
    const userValidation = await validateUser(userId, userType);
    if (!userValidation.valid) {
      return res.status(404).json({ message: userValidation.message });
    }

    const userServices = await UserService.findOne({ 
      user: userId,
      userType,
      isDeleted: false
    }).populate([
      { path: "user", select: "name email role" },
      { path: "services.service", select: "title shortDescription price icon images" },
      { path: "assignedBy", select: "name email" }
    ]);

    if (!userServices) {
      return res.status(200).json({
        message: `Nie znaleziono usług dla tego ${userType}`,
        data: { user: userId, userType, services: [] }
      });
    }

    return res.status(200).json({
      message: `Usługi pobrane pomyślnie dla ${userType}`,
      data: userServices
    });
  } catch (error) {
    console.error(`Error retrieving ${req.params.userType || 'user'} services:`, error);
    return res.status(500).json({ 
      message: `Nie udało się pobrać usług dla ${req.params.userType || 'użytkownika'}`,
      error: error.message
    });
  }
};

// Update a specific service for a user (patient or doctor)
exports.updateUserService = async (req, res) => {
  try {
    const { userId, userType, serviceId } = req.params;
    const { status, notes, price } = req.body;

    if (!userType || !["patient", "doctor"].includes(userType)) {
      return res.status(400).json({ 
        message: "Typ użytkownika musi być albo 'pacjent' albo 'lekarz'" 
      });
    }

    // Verify user exists with the specified role
    const userValidation = await validateUser(userId, userType);
    if (!userValidation.valid) {
      return res.status(404).json({ message: userValidation.message });
    }

    // Find user service record
    const userService = await UserService.findOne({ 
      user: userId,
      userType,
      isDeleted: false
    });

    if (!userService) {
      return res.status(404).json({ message: `Usługi dla tego ${userType} nie znalezione` });
    }

    // Find the specific service in the services array
    const serviceIndex = userService.services.findIndex(
      s => s.service.toString() === serviceId
    );

    if (serviceIndex === -1) {
      return res.status(404).json({ message: `Usługa dla tego ${userType} nie znaleziona` });
    }

    // Update the service
    if (status) userService.services[serviceIndex].status = status;
    if (notes) userService.services[serviceIndex].notes = notes;
    if (price !== undefined) {
      userService.services[serviceIndex].price = price;
      userService.services[serviceIndex].isCustomPrice = true;
    }
    
    // If status is completed, set completedDate
    if (status === "completed") {
      userService.services[serviceIndex].completedDate = new Date();
    }

    await userService.save();

    await userService.populate([
      { path: "user", select: "name email role" },
      { path: "services.service", select: "title shortDescription price icon images" },
      { path: "assignedBy", select: "name email" }
    ]);

    return res.status(200).json({
      message: `Usługa ${userType} zaktualizowana pomyślnie`,
      data: userService
    });
  } catch (error) {
    console.error(`Error updating ${req.params.userType || 'user'} service:`, error);
    return res.status(500).json({ 
      message: `Nie udało się zaktualizować usługi dla ${req.params.userType || 'użytkownika'}`,
      error: error.message
    });
  }
};

// Delete all services for a user (patient or doctor) - soft delete
exports.deleteUserServices = async (req, res) => {
  try {
    const { userId, userType } = req.params;

    if (!userType || !["patient", "doctor"].includes(userType)) {
      return res.status(400).json({ 
        message: "Typ użytkownika musi być albo 'pacjent' albo 'lekarz'" 
      });
    }

    // Verify user exists with the specified role
    const userValidation = await validateUser(userId, userType);
    if (!userValidation.valid) {
      return res.status(404).json({ message: userValidation.message });
    }

    // Find and mark as deleted
    const result = await UserService.findOneAndUpdate(
      { user: userId, userType },
      { isDeleted: true },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: `Usługi dla tego ${userType} nie znalezione` });
    }

    return res.status(200).json({
      message: `Usługi dla tego ${userType} usunięte pomyślnie`
    });
  } catch (error) {
    console.error(`Error deleting ${req.params.userType || 'user'} services:`, error);
    return res.status(500).json({ 
      message: `Nie udało się usunąć usług dla ${req.params.userType || 'użytkownika'}`,
      error: error.message
    });
  }
};

// Remove a specific service from a user (patient or doctor)
exports.removeServiceFromUser = async (req, res) => {
  try {
    const { userId, userType, serviceId } = req.params;

    if (!userType || !["patient", "doctor"].includes(userType)) {
      return res.status(400).json({ 
        message: "Typ użytkownika musi być albo 'pacjent' albo 'lekarz'" 
      });
    }

    // Verify user exists with the specified role
    const userValidation = await validateUser(userId, userType);
    if (!userValidation.valid) {
      return res.status(404).json({ message: userValidation.message });
    }

    // Find user service record
    const userService = await UserService.findOne({ 
      user: userId,
      userType,
      isDeleted: false
    });

    if (!userService) {
      return res.status(404).json({ message: `Usługi dla tego ${userType} nie znalezione` });
    }

    // Find and remove the specific service
    const initialLength = userService.services.length;
    userService.services = userService.services.filter(
      s => s.service.toString() !== serviceId
    );

    if (userService.services.length === initialLength) {
      return res.status(404).json({ message: `Service not found for this ${userType}` });
    }

    await userService.save();

    await userService.populate([
      { path: "user", select: "name email role" },
      { path: "services.service", select: "title shortDescription price icon images" },
      { path: "assignedBy", select: "name email" }
    ]);

    return res.status(200).json({
      message: `Usługa usunięta pomyślnie z ${userType}`,
      data: userService
    });
  } catch (error) {
    console.error(`Error removing service from ${req.params.userType || 'user'}:`, error);
    return res.status(500).json({ 
      message: `Nie udało się usunąć usługi z ${req.params.userType || 'użytkownika'}`,
      error: error.message
    });
  }
}; 
