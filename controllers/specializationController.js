// controllers/specializationController.js
const Specialization = require("../models/specialization");

// @desc    Get all specializations
// @route   GET /api/specializations
// @access  Public
const getSpecializations = (req, res) => {
  Specialization.find()
    .sort({ name: 1 })
    .then((specializations) => {
      res.status(200).json(specializations);
    })
    .catch((err) => {
      res
        .status(500)
        .json({
          message: "Failed to fetch specializations",
          error: err.message,
        });
    });
};

// @desc    Get single specialization
// @route   GET /api/specializations/:id
// @access  Public
const getSpecialization = (req, res) => {
  Specialization.findById(req.params.id)
    .then((specialization) => {
      if (!specialization) {
        return res.status(404).json({ message: "Specialization not found" });
      }
      res.status(200).json(specialization);
    })
    .catch((err) => {
      res
        .status(500)
        .json({
          message: "Failed to fetch specialization",
          error: err.message,
        });
    });
};

// @desc    Create new specialization
// @route   POST /api/specializations
// @access  Private/Admin
const createSpecialization = (req, res) => {
  const { name, description } = req.body;

  if (!name || !description) {
    return res
      .status(400)
      .json({ message: "Please provide name and description" });
  }

  // Check if specialization already exists
  Specialization.findOne({ name })
    .then((specializationExists) => {
      if (specializationExists) {
        return res
          .status(400)
          .json({ message: "Specialization already exists" });
      }

      // Create new specialization
      return Specialization.create({
        name,
        description,
      });
    })
    .then((specialization) => {
      res.status(201).json(specialization);
    })
    .catch((err) => {
      res
        .status(500)
        .json({
          message: "Failed to create specialization",
          error: err.message,
        });
    });
};

// @desc    Update specialization
// @route   PUT /api/specializations/:id
// @access  Private/Admin
const updateSpecialization = (req, res) => {
  const { name, description } = req.body;

  Specialization.findById(req.params.id)
    .then((specialization) => {
      if (!specialization) {
        return res.status(404).json({ message: "Specialization not found" });
      }

      specialization.name = name || specialization.name;
      specialization.description = description || specialization.description;

      return specialization.save();
    })
    .then((updatedSpecialization) => {
      res.status(200).json(updatedSpecialization);
    })
    .catch((err) => {
      res
        .status(500)
        .json({
          message: "Failed to update specialization",
          error: err.message,
        });
    });
};

// @desc    Delete specialization
// @route   DELETE /api/specializations/:id
// @access  Private/Admin
const deleteSpecialization = (req, res) => {
  Specialization.findById(req.params.id)
    .then((specialization) => {
      if (!specialization) {
        return res.status(404).json({ message: "Specialization not found" });
      }

      return specialization.deleteOne();
    })
    .then(() => {
      res.status(200).json({ message: "Specialization removed" });
    })
    .catch((err) => {
      res
        .status(500)
        .json({
          message: "Failed to delete specialization",
          error: err.message,
        });
    });
};

module.exports = {
  getSpecializations,
  getSpecialization,
  createSpecialization,
  updateSpecialization,
  deleteSpecialization,
};
