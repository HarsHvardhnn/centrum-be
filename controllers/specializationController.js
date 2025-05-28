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
          message: "Nie udało się pobrać specjalizacji",
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
        return res.status(404).json({ message: "Specjalizacja nie znaleziona" });
      }
      res.status(200).json(specialization);
    })
    .catch((err) => {
      res
        .status(500)
        .json({
          message: "Nie udało się pobrać specjalizacji",
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
      .json({ message: "Proszę podać nazwę i opis" });
  }

  Specialization.findOne({ name })
    .then((specializationExists) => {
      if (specializationExists) {
        res.status(400).json({ message: "Specjalizacja już istnieje" });
        return null; // stop the chain here
      }

      return Specialization.create({ name, description });
    })
    .then((specialization) => {
      if (specialization) {
        res.status(201).json(specialization);
      }
      // else, response was already sent above
    })
    .catch((err) => {
      res.status(500).json({
        message: "Nie udało się utworzyć specjalizacji",
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
        return res.status(404).json({ message: "Specjalizacja nie znaleziona" });
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
          message: "Nie udało się zaktualizować specjalizacji",
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
        return res.status(404).json({ message: "Specjalizacja nie znaleziona" });
      }

      return specialization.deleteOne();
    })
    .then(() => {
      res.status(200).json({ message: "Specjalizacja usunięta" });
    })
    .catch((err) => {
      res
        .status(500)
        .json({
          message: "Nie udało się usunąć specjalizacji",
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
