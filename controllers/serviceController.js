const Service = require("../models/services");

exports.createService = async (req, res) => {
  try {
    const { title, price, shortDescription, description, bulletPoints } =
      req.body;
    const images = req.files.map((file) => file.path);

    const service = new Service({
      title,
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
    res.status(500).json({ message: "Failed to create service", error });
  }
};

exports.getAllServices = async (req, res) => {
  try {
    const services = await Service.find({ isDeleted: false });
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: "Failed to get services", error });
  }
};

exports.getServiceById = async (req, res) => {
  try {
    const service = await Service.findOne({
      _id: req.params.id,
      isDeleted: false,
    });
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json(service);
  } catch (error) {
    res.status(500).json({ message: "Failed to get service", error });
  }
};

exports.updateService = async (req, res) => {
  try {
    const { title, icon, shortDescription, description, bulletPoints } =
      req.body;
    const updateData = {
      title,
      icon,
      shortDescription,
      description,
      bulletPoints: JSON.parse(bulletPoints),
      updatedBy: req.user.id,
      updatedAt: new Date(),
    };

    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map((file) => file.path);
    }

    const service = await Service.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    res.json(service);
  } catch (error) {
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
    res.status(500).json({ message: "Failed to delete service", error });
  }
};
