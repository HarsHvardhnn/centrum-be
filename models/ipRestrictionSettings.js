const mongoose = require("mongoose");

const ipRestrictionSettingsSchema = new mongoose.Schema(
  {
    // Główne ustawienie włączenia/wyłączenia ograniczeń IP
    isEnabled: {
      type: Boolean,
      default: true,
      required: true
    },
    
    // Tryb działania
    mode: {
      type: String,
      enum: ['strict', 'development', 'disabled'],
      default: 'strict',
      required: true
    },
    
    // Czy dozwolić localhost w trybie produkcyjnym
    allowLocalhostInProduction: {
      type: Boolean,
      default: false
    },
    
    // Czy wyświetlać szczegółowe logi
    enableDetailedLogging: {
      type: Boolean,
      default: true
    },
    
    // Maksymalna liczba dozwolonych nieautoryzowanych prób na godzinę
    maxUnauthorizedAttemptsPerHour: {
      type: Number,
      default: 100,
      min: 1,
      max: 1000
    },
    
    // Opis ostatniej zmiany
    lastChangeDescription: {
      type: String,
      maxlength: 500,
      default: "Początkowa konfiguracja systemu"
    },
    
    // Kto dokonał ostatniej zmiany
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Indeks dla szybkiego dostępu
ipRestrictionSettingsSchema.index({ isEnabled: 1 });

// Singleton pattern - tylko jeden dokument ustawień
ipRestrictionSettingsSchema.statics.getInstance = async function() {
  let settings = await this.findOne();
  
  if (!settings) {
    // Jeśli nie ma ustawień, utwórz domyślne
    const User = require("./user-entity/user");
    const adminUser = await User.findOne({ role: "admin" });
    
    if (!adminUser) {
      throw new Error("Nie można utworzyć ustawień: brak użytkownika admin");
    }
    
    settings = new this({
      isEnabled: true,
      mode: 'development', // Bezpieczny start
      lastModifiedBy: adminUser._id,
      lastChangeDescription: "Automatyczne utworzenie domyślnych ustawień"
    });
    
    await settings.save();
  }
  
  return settings;
};

// Metoda do bezpiecznej aktualizacji ustawień
ipRestrictionSettingsSchema.statics.updateSettings = async function(updates, userId) {
  const settings = await this.getInstance();
  
  // Zapisz poprzednie wartości dla logowania
  const previousState = {
    isEnabled: settings.isEnabled,
    mode: settings.mode,
    allowLocalhostInProduction: settings.allowLocalhostInProduction
  };
  
  // Aktualizuj pola
  Object.keys(updates).forEach(key => {
    if (settings.schema.paths[key] && key !== '_id' && key !== 'createdAt') {
      settings[key] = updates[key];
    }
  });
  
  settings.lastModifiedBy = userId;
  
  // Automatyczny opis zmian
  if (!updates.lastChangeDescription) {
    const changes = [];
    if (previousState.isEnabled !== settings.isEnabled) {
      changes.push(`Ograniczenia IP: ${settings.isEnabled ? 'WŁĄCZONE' : 'WYŁĄCZONE'}`);
    }
    if (previousState.mode !== settings.mode) {
      changes.push(`Tryb: ${settings.mode}`);
    }
    if (previousState.allowLocalhostInProduction !== settings.allowLocalhostInProduction) {
      changes.push(`Localhost w produkcji: ${settings.allowLocalhostInProduction ? 'dozwolony' : 'zabroniony'}`);
    }
    
    settings.lastChangeDescription = changes.length > 0 
      ? changes.join(', ') 
      : 'Aktualizacja ustawień ograniczeń IP';
  }
  
  await settings.save();
  
  // Loguj ważne zmiany
  if (previousState.isEnabled !== settings.isEnabled) {
    console.log(`🔒 OGRANICZENIA IP ${settings.isEnabled ? 'WŁĄCZONE' : 'WYŁĄCZONE'} przez użytkownika ${userId}`);
  }
  
  return settings;
};

// Metoda sprawdzania czy ograniczenia są aktywne
ipRestrictionSettingsSchema.statics.isRestrictionActive = async function() {
  const settings = await this.getInstance();
  
  // Sprawdź podstawowe włączenie
  if (!settings.isEnabled) {
    return false;
  }
  
  // Sprawdź tryb
  if (settings.mode === 'disabled') {
    return false;
  }
  
  // W trybie development pozwól na localhost
  if (settings.mode === 'development' && process.env.NODE_ENV === 'development') {
    return 'development'; // Specjalna wartość dla trybu dev
  }
  
  return true;
};

const IpRestrictionSettings = mongoose.model("IpRestrictionSettings", ipRestrictionSettingsSchema);

module.exports = IpRestrictionSettings; 