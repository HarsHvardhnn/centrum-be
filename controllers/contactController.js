const Contact = require("../models/contact");
const { authorizeRoles } = require("../middlewares/authenticateRole");

// Create a new contact message (public access)
exports.createContact = async (req, res) => {
  try {
    const { name, email, subject, message ,privacyPolicyAccepted} = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Proszę podać wszystkie wymagane pola"
      });
    }

    const contact = await Contact.create({
      name,
      email,
      subject,
      message,
      privacyPolicyAccepted
    });

    res.status(201).json({
      success: true,
      message: "Wiadomość kontaktowa wysłana pomyślnie",
      data: contact
    });
  } catch (error) {
    console.error("Błąd podczas tworzenia wiadomości kontaktowej:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się wysłać wiadomości kontaktowej",
      error: error.message
    });
  }
};

// Get all contact messages (admin and receptionist only)
exports.getAllContacts = async (req, res) => {
  try {
    // Extract query parameters with defaults
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      status,
      search
    } = req.query;

    // Build query
    const query = {};
    
    // Add status filter if provided
    if (status && ["new", "read", "replied"].includes(status)) {
      query.status = status;
    }

    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } }
      ];
    }

    // Create sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const skipAmount = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count for pagination info
    const totalCount = await Contact.countDocuments(query);
    
    // Execute the query with pagination and sorting
    const contacts = await Contact.find(query)
      .sort(sort)
      .skip(skipAmount)
      .limit(parseInt(limit))
      .lean();

    // Return response with pagination metadata
    res.status(200).json({
      success: true,
      count: contacts.length,
      total: totalCount,
      pages: Math.ceil(totalCount / parseInt(limit)),
      currentPage: parseInt(page),
      data: contacts
    });
  } catch (error) {
    console.error("Error fetching contact messages:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się pobrać wiadomości kontaktowych",
      error: error.message
    });
  }
};

// Get single contact message (admin and receptionist only)
exports.getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id).lean();

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Wiadomość kontaktowa nie znaleziona"
      });
    }

    res.status(200).json({
      success: true,
      data: contact
    });
  } catch (error) {
    console.error("Error fetching contact message:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się pobrać wiadomości kontaktowej",
      error: error.message
    });
  }
};

// Update contact message status (admin and receptionist only)
exports.updateContactStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !["new", "read", "replied"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Proszę podać poprawny status"
      });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).lean();

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Wiadomość kontaktowa nie znaleziona"
      });
    }

    res.status(200).json({
      success: true,
      message: "Status wiadomości kontaktowej zaktualizowany pomyślnie",
      data: contact
    });
  } catch (error) {
    console.error("Error updating contact message:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się zaktualizować wiadomości kontaktowej",
      error: error.message
    });
  }
};

// Delete contact message (admin and receptionist only)
exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Wiadomość kontaktowa nie znaleziona"
      });
    }

    res.status(200).json({
      success: true,
      message: "Wiadomość kontaktowa usunięta pomyślnie"
    });
  } catch (error) {
    console.error("Error deleting contact message:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się usunąć wiadomości kontaktowej",
      error: error.message
    });
  }
}; 