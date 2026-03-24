const SmsTemplate = require("../models/smsTemplate");
const { validationResult } = require("express-validator");

// Create SMS Template
exports.createSmsTemplate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { title, description } = req.body;

    // Check if template with same title already exists
    const existingTemplate = await SmsTemplate.findOne({
      title: title.trim(),
      isActive: true,
    });

    if (existingTemplate) {
      return res.status(409).json({
        success: false,
        message: "Szablon o tym tytule już istnieje",
      });
    }

    const smsTemplate = new SmsTemplate({
      title: title.trim(),
      description: description.trim(),
      createdBy: req.user.id,
    });

    await smsTemplate.save();

    res.status(201).json({
      success: true,
      message: "Szablon SMS został utworzony pomyślnie",
      data: smsTemplate,
    });
  } catch (error) {
    console.error("Error creating SMS template:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się utworzyć szablonu SMS",
      error: error.message,
    });
  }
};

// Get All SMS Templates
exports.getAllSmsTemplates = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
      isActive,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObject = {};
    sortObject[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Build query
    const query = {};

    // Active filter
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const smsTemplates = await SmsTemplate.find(query)
      .populate("createdBy", "name.first name.last email")
      .populate("updatedBy", "name.first name.last email")
      .sort(sortObject)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SmsTemplate.countDocuments(query);

    res.status(200).json({
      success: true,
      data: smsTemplates,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching SMS templates:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się pobrać szablonów SMS",
      error: error.message,
    });
  }
};

// Get SMS Template by ID
exports.getSmsTemplateById = async (req, res) => {
  try {
    const { id } = req.params;

    const smsTemplate = await SmsTemplate.findById(id)
      .populate("createdBy", "name.first name.last email")
      .populate("updatedBy", "name.first name.last email");

    if (!smsTemplate) {
      return res.status(404).json({
        success: false,
        message: "Szablon SMS nie został znaleziony",
      });
    }

    res.status(200).json({
      success: true,
      data: smsTemplate,
    });
  } catch (error) {
    console.error("Error fetching SMS template:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się pobrać szablonu SMS",
      error: error.message,
    });
  }
};

// Update SMS Template
exports.updateSmsTemplate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const { title, description, isActive } = req.body;

    const smsTemplate = await SmsTemplate.findById(id);

    if (!smsTemplate) {
      return res.status(404).json({
        success: false,
        message: "Szablon SMS nie został znaleziony",
      });
    }

    // Check if template with same title already exists (excluding current template)
    if (title && title.trim() !== smsTemplate.title) {
      const existingTemplate = await SmsTemplate.findOne({
        title: title.trim(),
        isActive: true,
        _id: { $ne: id },
      });

      if (existingTemplate) {
        return res.status(409).json({
          success: false,
          message: "Szablon o tym tytule już istnieje",
        });
      }
    }

    // Update fields
    if (title !== undefined) {
      smsTemplate.title = title.trim();
    }
    if (description !== undefined) {
      smsTemplate.description = description.trim();
    }
    if (isActive !== undefined) {
      smsTemplate.isActive = isActive;
    }

    smsTemplate.updatedBy = req.user.id;

    await smsTemplate.save();

    res.status(200).json({
      success: true,
      message: "Szablon SMS został zaktualizowany pomyślnie",
      data: smsTemplate,
    });
  } catch (error) {
    console.error("Error updating SMS template:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się zaktualizować szablonu SMS",
      error: error.message,
    });
  }
};

// Permanently delete multiple SMS templates (bulk). Body: { ids: string[] }
exports.bulkPermanentDeleteSmsTemplates = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Podaj tablicę identyfikatorów (ids) do usunięcia",
      });
    }

    const validIds = ids.filter((id) => id && typeof id === "string").map((id) => id.trim()).filter(Boolean);
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Brak prawidłowych identyfikatorów",
      });
    }

    const result = await SmsTemplate.deleteMany({ _id: { $in: validIds } });

    res.status(200).json({
      success: true,
      message: `Trwale usunięto ${result.deletedCount} szablonów SMS`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error bulk deleting SMS templates:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się trwale usunąć szablonów SMS",
      error: error.message,
    });
  }
};

// Delete SMS Template (Soft Delete)
exports.deleteSmsTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const smsTemplate = await SmsTemplate.findById(id);

    if (!smsTemplate) {
      return res.status(404).json({
        success: false,
        message: "Szablon SMS nie został znaleziony",
      });
    }

    // Soft delete by setting isActive to false
    smsTemplate.isActive = false;
    smsTemplate.updatedBy = req.user.id;

    await smsTemplate.save();

    res.status(200).json({
      success: true,
      message: "Szablon SMS został usunięty pomyślnie",
    });
  } catch (error) {
    console.error("Error deleting SMS template:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się usunąć szablonu SMS",
      error: error.message,
    });
  }
};

// Get Active SMS Templates Only
exports.getActiveSmsTemplates = async (req, res) => {
  try {
    const smsTemplates = await SmsTemplate.find({ isActive: true })
      .select("title description")
      .sort({ title: 1 });

    res.status(200).json({
      success: true,
      data: smsTemplates,
    });
  } catch (error) {
    console.error("Error fetching active SMS templates:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się pobrać aktywnych szablonów SMS",
      error: error.message,
    });
  }
};

// Toggle SMS Template Status
exports.toggleSmsTemplateStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const smsTemplate = await SmsTemplate.findById(id);

    if (!smsTemplate) {
      return res.status(404).json({
        success: false,
        message: "Szablon SMS nie został znaleziony",
      });
    }   

    smsTemplate.isActive = !smsTemplate.isActive;
    smsTemplate.updatedBy = req.user.id;

    await smsTemplate.save();

    res.status(200).json({
      success: true,
      message: `Szablon SMS został ${smsTemplate.isActive ? "aktywowany" : "dezaktywowany"} pomyślnie`,
      data: smsTemplate,
    });
  } catch (error) {
    console.error("Error toggling SMS template status:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się przełączyć statusu szablonu SMS",
      error: error.message,
    });
  }
}; 