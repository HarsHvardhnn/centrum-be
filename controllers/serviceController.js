const Service = require("../models/services");
const { generateSlug, ensureUniqueSlug } = require("../utils/slugUtils");

exports.createService = async (req, res) => {
  try {
    const { title, price, shortDescription, description, bulletPoints } =
      req.body;
    const images = req.files.map((file) => file.path);

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
      bulletPoints: JSON.parse(bulletPoints),
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
      .select('title slug description shortDescription images price bulletPoints createdAt updatedAt');
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
    const { title, icon, shortDescription, description, bulletPoints,price } =
      req.body;
    const updateData = {
      title,
      icon,
      shortDescription,
      description,
      bulletPoints: JSON.parse(bulletPoints),
      updatedBy: req.user.id,
      updatedAt: new Date(),
      price,
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
    res.json(service);
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ message: "Failed to update service", error });
  }
};

exports.deleteService = async (req, res) => {
  try {
    await Service.findByIdAndUpdate(req.params.id, {
      isDeleted: true,
      updatedBy: req.user.id,
      updatedAt: new Date(),
    });
    res.json({ message: "Service deleted" });
  } catch (error) {
    res.status(500).json({ message: "Nie udało się usunąć usługi", error });
  }
};
