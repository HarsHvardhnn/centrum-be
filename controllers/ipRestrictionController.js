const AllowedIp = require("../models/allowedIp");
const IpRestrictionSettings = require("../models/ipRestrictionSettings");
const mongoose = require("mongoose");

/**
 * Get all allowed IPs with pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAllowedIps = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter
    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    if (req.query.search) {
      filter.$or = [
        { ipAddress: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const allowedIps = await AllowedIp.find(filter)
      .populate('createdBy', 'name.first name.last email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AllowedIp.countDocuments(filter);

    return res.status(200).json({
      success: true,
      message: "Dozwolone adresy IP pobrane pomyślnie",
      data: {
        allowedIps,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  } catch (error) {
    console.error("Błąd podczas pobierania dozwolonych adresów IP:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać dozwolonych adresów IP",
      error: error.message
    });
  }
};

/**
 * Get a specific allowed IP by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAllowedIpById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy format ID adresu IP"
      });
    }

    const allowedIp = await AllowedIp.findById(id)
      .populate('createdBy', 'name.first name.last email');

    if (!allowedIp) {
      return res.status(404).json({
        success: false,
        message: "Dozwolony adres IP nie został znaleziony"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Dozwolony adres IP pobrany pomyślnie",
      data: allowedIp
    });
  } catch (error) {
    console.error("Błąd podczas pobierania dozwolonego adresu IP:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać dozwolonego adresu IP",
      error: error.message
    });
  }
};

/**
 * Add a new allowed IP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.addAllowedIp = async (req, res) => {
  try {
    const { ipAddress, description, isActive = true } = req.body;

    // Validation
    if (!ipAddress || !description) {
      return res.status(400).json({
        success: false,
        message: "Adres IP i opis są wymagane"
      });
    }

    // Check if IP already exists
    const existingIp = await AllowedIp.findOne({ ipAddress });
    if (existingIp) {
      return res.status(409).json({
        success: false,
        message: "Ten adres IP już znajduje się na liście dozwolonych"
      });
    }

    const newAllowedIp = new AllowedIp({
      ipAddress: ipAddress.trim(),
      description: description.trim(),
      isActive,
      createdBy: req.user.id
    });

    await newAllowedIp.save();

    // Populate the created document
    await newAllowedIp.populate('createdBy', 'name.first name.last email');

    return res.status(201).json({
      success: true,
      message: "Adres IP został pomyślnie dodany do listy dozwolonych",
      data: newAllowedIp
    });
  } catch (error) {
    console.error("Błąd podczas dodawania dozwolonego adresu IP:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Błąd walidacji",
        error: Object.values(error.errors).map(err => err.message)
      });
    }

    return res.status(500).json({
      success: false,
      message: "Nie udało się dodać adresu IP",
      error: error.message
    });
  }
};

/**
 * Update an allowed IP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateAllowedIp = async (req, res) => {
  try {
    const { id } = req.params;
    const { ipAddress, description, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy format ID adresu IP"
      });
    }

    // Check if IP exists
    const allowedIp = await AllowedIp.findById(id);
    if (!allowedIp) {
      return res.status(404).json({
        success: false,
        message: "Dozwolony adres IP nie został znaleziony"
      });
    }

    // If updating IP address, check for duplicates
    if (ipAddress && ipAddress !== allowedIp.ipAddress) {
      const existingIp = await AllowedIp.findOne({ 
        ipAddress: ipAddress.trim(),
        _id: { $ne: id }
      });
      if (existingIp) {
        return res.status(409).json({
          success: false,
          message: "Ten adres IP już znajduje się na liście dozwolonych"
        });
      }
    }

    // Update fields
    if (ipAddress !== undefined) allowedIp.ipAddress = ipAddress.trim();
    if (description !== undefined) allowedIp.description = description.trim();
    if (isActive !== undefined) allowedIp.isActive = isActive;

    await allowedIp.save();
    await allowedIp.populate('createdBy', 'name.first name.last email');

    return res.status(200).json({
      success: true,
      message: "Dozwolony adres IP został pomyślnie zaktualizowany",
      data: allowedIp
    });
  } catch (error) {
    console.error("Błąd podczas aktualizacji dozwolonego adresu IP:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Błąd walidacji",
        error: Object.values(error.errors).map(err => err.message)
      });
    }

    return res.status(500).json({
      success: false,
      message: "Nie udało się zaktualizować adresu IP",
      error: error.message
    });
  }
};

/**
 * Delete an allowed IP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteAllowedIp = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy format ID adresu IP"
      });
    }

    const allowedIp = await AllowedIp.findById(id);
    if (!allowedIp) {
      return res.status(404).json({
        success: false,
        message: "Dozwolony adres IP nie został znaleziony"
      });
    }

    await AllowedIp.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Adres IP został pomyślnie usunięty z listy dozwolonych"
    });
  } catch (error) {
    console.error("Błąd podczas usuwania dozwolonego adresu IP:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się usunąć adresu IP",
      error: error.message
    });
  }
};

/**
 * Bulk operations for allowed IPs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.bulkUpdateAllowedIps = async (req, res) => {
  try {
    const { action, ids, data } = req.body;

    if (!action || !ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: "Akcja i tablica ID są wymagane"
      });
    }

    // Validate ObjectIds
    const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Znaleziono nieprawidłowe formaty ID",
        invalidIds
      });
    }

    let result;
    switch (action) {
      case 'activate':
        result = await AllowedIp.updateMany(
          { _id: { $in: ids } },
          { isActive: true }
        );
        break;
      case 'deactivate':
        result = await AllowedIp.updateMany(
          { _id: { $in: ids } },
          { isActive: false }
        );
        break;
      case 'delete':
        result = await AllowedIp.deleteMany({ _id: { $in: ids } });
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Nieprawidłowa akcja. Obsługiwane akcje: activate, deactivate, delete"
        });
    }

    return res.status(200).json({
      success: true,
      message: `Operacja masowa ${action} zakończona pomyślnie`,
      data: {
        modifiedCount: result.modifiedCount || result.deletedCount,
        matchedCount: result.matchedCount || result.deletedCount
      }
    });
  } catch (error) {
    console.error("Błąd podczas operacji masowej:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się wykonać operacji masowej",
      error: error.message
    });
  }
};

/**
 * Get IP restriction statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getIpStats = async (req, res) => {
  try {
    const stats = await AllowedIp.aggregate([
      {
        $group: {
          _id: null,
          totalIps: { $sum: 1 },
          activeIps: { $sum: { $cond: ['$isActive', 1, 0] } },
          inactiveIps: { $sum: { $cond: ['$isActive', 0, 1] } },
          totalUsage: { $sum: '$usageCount' },
          recentlyUsed: {
            $sum: {
              $cond: [
                { $gte: ['$lastUsed', new Date(Date.now() - 24 * 60 * 60 * 1000)] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const recentlyAdded = await AllowedIp.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    return res.status(200).json({
      success: true,
      message: "Statystyki ograniczeń IP pobrane pomyślnie",
      data: {
        ...(stats[0] || {
          totalIps: 0,
          activeIps: 0,
          inactiveIps: 0,
          totalUsage: 0,
          recentlyUsed: 0
        }),
        recentlyAdded
      }
    });
  } catch (error) {
    console.error("Błąd podczas pobierania statystyk IP:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać statystyk IP",
      error: error.message
    });
  }
};

/**
 * Check if current IP is allowed (for testing)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.checkCurrentIp = async (req, res) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const allowedIp = await AllowedIp.findMatchingIp(clientIp);

    return res.status(200).json({
      success: true,
      message: "Sprawdzenie IP zakończone",
      data: {
        clientIp,
        isAllowed: !!allowedIp,
        allowedIpInfo: allowedIp ? {
          id: allowedIp._id,
          ipAddress: allowedIp.ipAddress,
          description: allowedIp.description,
          lastUsed: allowedIp.lastUsed,
          usageCount: allowedIp.usageCount
        } : null
      }
    });
  } catch (error) {
    console.error("Błąd podczas sprawdzania bieżącego IP:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się sprawdzić bieżącego IP",
      error: error.message
    });
  }
};

/**
 * Pobierz ustawienia ograniczeń IP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getIpRestrictionSettings = async (req, res) => {
  try {
    const settings = await IpRestrictionSettings.getInstance();
    await settings.populate('lastModifiedBy', 'name.first name.last email');

    return res.status(200).json({
      success: true,
      message: "Ustawienia ograniczeń IP pobrane pomyślnie",
      data: settings
    });
  } catch (error) {
    console.error("Błąd podczas pobierania ustawień ograniczeń IP:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać ustawień ograniczeń IP",
      error: error.message
    });
  }
};

/**
 * Aktualizuj ustawienia ograniczeń IP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateIpRestrictionSettings = async (req, res) => {
  try {
    const {
      isEnabled,
      mode,
      allowLocalhostInProduction,
      enableDetailedLogging,
      maxUnauthorizedAttemptsPerHour,
      lastChangeDescription
    } = req.body;

    // Walidacja trybu
    const validModes = ['strict', 'development', 'disabled'];
    if (mode && !validModes.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy tryb. Dozwolone wartości: strict, development, disabled"
      });
    }

    // Walidacja maxUnauthorizedAttemptsPerHour
    if (maxUnauthorizedAttemptsPerHour !== undefined) {
      if (maxUnauthorizedAttemptsPerHour < 1 || maxUnauthorizedAttemptsPerHour > 1000) {
        return res.status(400).json({
          success: false,
          message: "Maksymalna liczba prób musi być między 1 a 1000"
        });
      }
    }

    const updates = {};
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;
    if (mode !== undefined) updates.mode = mode;
    if (allowLocalhostInProduction !== undefined) updates.allowLocalhostInProduction = allowLocalhostInProduction;
    if (enableDetailedLogging !== undefined) updates.enableDetailedLogging = enableDetailedLogging;
    if (maxUnauthorizedAttemptsPerHour !== undefined) updates.maxUnauthorizedAttemptsPerHour = maxUnauthorizedAttemptsPerHour;
    if (lastChangeDescription !== undefined) updates.lastChangeDescription = lastChangeDescription;

    const updatedSettings = await IpRestrictionSettings.updateSettings(updates, req.user.id);
    await updatedSettings.populate('lastModifiedBy', 'name.first name.last email');

    return res.status(200).json({
      success: true,
      message: "Ustawienia ograniczeń IP zostały pomyślnie zaktualizowane",
      data: updatedSettings
    });
  } catch (error) {
    console.error("Błąd podczas aktualizacji ustawień ograniczeń IP:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się zaktualizować ustawień ograniczeń IP",
      error: error.message
    });
  }
};

/**
 * Szybkie przełączenie ograniczeń IP (włącz/wyłącz)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.toggleIpRestrictions = async (req, res) => {
  try {
    const settings = await IpRestrictionSettings.getInstance();
    const newState = !settings.isEnabled;
    
    const updatedSettings = await IpRestrictionSettings.updateSettings({
      isEnabled: newState,
      lastChangeDescription: `Szybkie przełączenie: ograniczenia IP ${newState ? 'włączone' : 'wyłączone'}`
    }, req.user.id);

    await updatedSettings.populate('lastModifiedBy', 'name.first name.last email');

    return res.status(200).json({
      success: true,
      message: `Ograniczenia IP zostały ${newState ? 'włączone' : 'wyłączone'}`,
      data: {
        isEnabled: updatedSettings.isEnabled,
        previousState: !newState,
        changedBy: updatedSettings.lastModifiedBy,
        changedAt: updatedSettings.updatedAt
      }
    });
  } catch (error) {
    console.error("Błąd podczas przełączania ograniczeń IP:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się przełączyć ograniczeń IP",
      error: error.message
    });
  }
};

/**
 * Public endpoint to check if an IP is allowed without authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.checkIpPublic = async (req, res) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const settings = await IpRestrictionSettings.getInstance();

    // If IP restrictions are disabled, all IPs are allowed
    if (!settings.isEnabled) {
      return res.status(200).json({
        success: true,
        data: {
          clientIp,
          isAllowed: true,
          reason: "IP restrictions are disabled"
        }
      });
    }

    // Check if it's localhost in development mode
    const isLocalhostInDev = (settings.mode === 'development' || process.env.NODE_ENV === 'development') && 
                            (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.startsWith('192.168.') || 
                             clientIp.startsWith('10.') || clientIp === 'localhost' || clientIp === '0.0.0.0');

    if (isLocalhostInDev) {
      return res.status(200).json({
        success: true,
        data: {
          clientIp,
          isAllowed: true,
          reason: "Development mode allows localhost"
        }
      });
    }
    console.log(clientIp,"is localhost".isLocalhostInDev);

    // Check if IP is in allowed list
    const allowedIp = await AllowedIp.findMatchingIp(clientIp);
    
    return res.status(200).json({
      success: true,
      data: {
        clientIp,
        isAllowed: !!allowedIp,
        reason: allowedIp ? "IP is in allowed list" : "IP is not in allowed list"
      }
    });
  } catch (error) {
    console.error("Error checking IP validity:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check IP validity",
      error: error.message
    });
  }
}; 