const Service = require("../models/services");
const { generateSlug, ensureUniqueSlug } = require("../utils/slugUtils");
const { updateServicePricesInRelatedModels } = require("../utils/updateServicePrices");
const { deleteServiceFromRelatedModels } = require("../utils/deleteServiceFromRelatedModels");

exports.createService = async (req, res) => {
  try {
    const { title, price, shortDescription, description, bulletPoints, redirectionUrl } =
      req.body;
    const images = req.files ? req.files.map((file) => file.path) : [];

    // Generate unique slug from title
    const baseSlug = generateSlug(title);
    const uniqueSlug = await ensureUniqueSlug(Service, baseSlug);

    // Create service with explicitly generated slug
    const service = new Service({
      title,
      slug: uniqueSlug,
      price,
      shortDescription,
      description,
      bulletPoints: bulletPoints ? JSON.parse(bulletPoints) : [],
      redirectionUrl,
      images,
      createdBy: req.user.id,
    });

    await service.save();
    res.status(201).json(service);
  } catch (error) {
    console.error('Error creating service:', error);
    
    // Handle specific errors
    if (error.code === 11000) {
      // Duplicate key error (likely slug conflict)
      if (error.keyPattern && error.keyPattern.slug) {
        return res.status(400).json({ 
          message: "A service with similar title already exists. Please use a different title." 
        });
      }
    }
    
    res.status(500).json({ message: "Failed to create service", error });
  }
};

exports.getAllServices = async (req, res) => {
  try {
    const services = await Service.find({ isDeleted: false })
      .select('title slug description shortDescription images price bulletPoints redirectionUrl createdAt updatedAt');
    res.json(services);
  } catch (error) {
    console.error('Error getting services:', error);
    res.status(500).json({ message: "Failed to get services", error });
  }
};

// Get one service by slug
exports.getServiceBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const service = await Service.findOne({
      slug,
      isDeleted: false,
    });
    
    console.log(service,"service")
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    res.json(service);
  } catch (error) {
    res.status(500).json({ message: "Failed to get service", error });
  }
};

// Get one service by ID (keeping for backward compatibility)
exports.getServiceById = async (req, res) => {
  try {
    const service = await Service.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!service) return res.status(404).json({ message: "Usługa nie znaleziona" });
    res.json(service);
  } catch (error) {
    res.status(500).json({ message: "Nie udało się pobrać usługi", error });
  }
};

exports.updateService = async (req, res) => {
  try {
    const { title, icon, shortDescription, description, bulletPoints, price, redirectionUrl } =
      req.body;
    
    // Get the current service to check if price is being updated
    const currentService = await Service.findById(req.params.id);
    if (!currentService) {
      return res.status(404).json({ message: "Service not found" });
    }

    const updateData = {
      title,
      icon,
      shortDescription,
      description,
      bulletPoints: bulletPoints ? JSON.parse(bulletPoints) : currentService.bulletPoints,
      updatedBy: req.user.id,
      updatedAt: new Date(),
      price,
      redirectionUrl,
    };

    // If title is being updated, regenerate slug
    if (title) {
      const baseSlug = generateSlug(title);
      updateData.slug = await ensureUniqueSlug(Service, baseSlug, req.params.id);
    }

    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map((file) => file.path);
    }

    const service = await Service.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    // If price is being updated, update prices in related models
    if (price && currentService.price !== price) {
      try {
        await updateServicePricesInRelatedModels(req.params.id, parseFloat(price));
      } catch (priceUpdateError) {
        console.error('Error updating prices in related models:', priceUpdateError);
        // Don't fail the main update, just log the error
      }
    }

    res.json(service);
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ message: "Failed to update service", error });
  }
};

exports.deleteService = async (req, res) => {
  try {
    // First, check if service exists
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    // Mark service as deleted
    await Service.findByIdAndUpdate(req.params.id, {
      isDeleted: true,
      updatedBy: req.user.id,
      updatedAt: new Date(),
    });

    // Remove service from related models
    try {
      await deleteServiceFromRelatedModels(req.params.id);
    } catch (relatedModelsError) {
      console.error('Error removing service from related models:', relatedModelsError);
      // Don't fail the main delete, just log the error
    }

    res.json({ message: "Service deleted" });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ message: "Nie udało się usunąć usługi", error });
  }
};
