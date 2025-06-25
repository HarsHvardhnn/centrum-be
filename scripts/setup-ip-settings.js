const mongoose = require("mongoose");
const IpRestrictionSettings = require("../models/ipRestrictionSettings");
const User = require("../models/user-entity/user");
const connectDB = require("../config/db");
require("dotenv").config();

/**
 * Skrypt konfiguracji ustawień ograniczeń IP
 * Ten skrypt inicjalizuje ustawienia systemu ograniczeń IP
 */
const setupIpSettings = async () => {
  try {
    console.log("🔧 Konfigurowanie ustawień ograniczeń IP...");
    
    // Połączenie z bazą danych
    await connectDB();
    console.log("✅ Połączono z bazą danych");

    // Sprawdź czy ustawienia już istnieją
    const existingSettings = await IpRestrictionSettings.findOne();
    
    if (existingSettings) {
      console.log("📋 Znaleziono istniejące ustawienia:");
      console.log(`   Włączone: ${existingSettings.isEnabled ? '🟢 TAK' : '🔴 NIE'}`);
      console.log(`   Tryb: ${existingSettings.mode}`);
      console.log(`   Localhost w produkcji: ${existingSettings.allowLocalhostInProduction ? '🟢 TAK' : '🔴 NIE'}`);
      console.log(`   Ostatnia zmiana: ${existingSettings.updatedAt.toLocaleString()}`);
      console.log(`   Opis: ${existingSettings.lastChangeDescription}`);
      
      console.log("\n✅ Ustawienia już skonfigurowane");
      process.exit(0);
    }

    // Utwórz nowe ustawienia
    const settings = await IpRestrictionSettings.getInstance();
    
    console.log("✅ Utworzono domyślne ustawienia ograniczeń IP:");
    console.log(`   Włączone: ${settings.isEnabled ? '🟢 TAK' : '🔴 NIE'}`);
    console.log(`   Tryb: ${settings.mode}`);
    console.log(`   Localhost w produkcji: ${settings.allowLocalhostInProduction ? '🟢 TAK' : '🔴 NIE'}`);
    console.log(`   Szczegółowe logi: ${settings.enableDetailedLogging ? '🟢 TAK' : '🔴 NIE'}`);
    console.log(`   Max prób na godzinę: ${settings.maxUnauthorizedAttemptsPerHour}`);

    console.log("\n🔒 Uwagi:");
    console.log("- Ustawienia można zmieniać przez API: /api/ip-restrictions/settings");
    console.log("- Szybkie przełączanie: POST /api/ip-restrictions/settings/toggle");
    console.log("- W trybie 'development' localhost jest automatycznie dozwolony");
    console.log("- W trybie 'disabled' wszystkie ograniczenia są wyłączone");

    console.log("\n🚀 Następne kroki:");
    console.log("1. Skonfiguruj frontend do zarządzania ustawieniami");
    console.log("2. Przetestuj przełączanie ograniczeń");
    console.log("3. Dostosuj tryb do środowiska (development/strict)");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Błąd podczas konfigurowania ustawień ograniczeń IP:", error);
    process.exit(1);
  }
};

/**
 * Wyświetl obecne ustawienia
 */
const showCurrentSettings = async () => {
  try {
    console.log("📊 Obecne Ustawienia Ograniczeń IP");
    console.log("=".repeat(40));
    
    await connectDB();
    
    const settings = await IpRestrictionSettings.findOne()
      .populate('lastModifiedBy', 'name.first name.last email');

    if (!settings) {
      console.log("📭 Brak skonfigurowanych ustawień");
      console.log("💡 Uruchom: node setup-ip-settings.js setup");
      process.exit(0);
    }

    console.log(`🔒 Status: ${settings.isEnabled ? '🟢 WŁĄCZONE' : '🔴 WYŁĄCZONE'}`);
    console.log(`⚙️  Tryb: ${settings.mode.toUpperCase()}`);
    console.log(`🏠 Localhost w produkcji: ${settings.allowLocalhostInProduction ? '🟢 TAK' : '🔴 NIE'}`);
    console.log(`📝 Szczegółowe logi: ${settings.enableDetailedLogging ? '🟢 TAK' : '🔴 NIE'}`);
    console.log(`⚡ Max prób/godzina: ${settings.maxUnauthorizedAttemptsPerHour}`);
    console.log(`📅 Utworzono: ${settings.createdAt.toLocaleString()}`);
    console.log(`📅 Ostatnia zmiana: ${settings.updatedAt.toLocaleString()}`);
    console.log(`👤 Zmodyfikowane przez: ${settings.lastModifiedBy ? 
      `${settings.lastModifiedBy.name?.first} ${settings.lastModifiedBy.name?.last} (${settings.lastModifiedBy.email})` 
      : 'System'}`);
    console.log(`💬 Opis ostatniej zmiany: ${settings.lastChangeDescription}`);

    // Sprawdź status aktywności
    const isActive = await IpRestrictionSettings.isRestrictionActive();
    console.log(`\n🎯 Efektywny status:`);
    if (isActive === false) {
      console.log("   🔓 NIEAKTYWNE - Ograniczenia wyłączone");
    } else if (isActive === 'development') {
      console.log("   🔧 TRYB DEWELOPERSKI - Localhost dozwolony");
    } else if (isActive === true) {
      console.log("   🔒 AKTYWNE - Pełne ograniczenia włączone");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Błąd podczas wyświetlania ustawień:", error);
    process.exit(1);
  }
};

/**
 * Reset ustawień do domyślnych
 */
const resetSettings = async () => {
  try {
    console.log("🔄 Resetowanie ustawień ograniczeń IP...");
    
    await connectDB();
    
    const deleteResult = await IpRestrictionSettings.deleteMany({});
    console.log(`🗑️ Usunięto ${deleteResult.deletedCount} dokument(ów) ustawień`);
    
    // Utwórz nowe domyślne ustawienia
    const newSettings = await IpRestrictionSettings.getInstance();
    console.log("✅ Utworzono nowe domyślne ustawienia");
    
    console.log(`   Włączone: ${newSettings.isEnabled ? '🟢 TAK' : '🔴 NIE'}`);
    console.log(`   Tryb: ${newSettings.mode}`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Błąd podczas resetowania ustawień:", error);
    process.exit(1);
  }
};

// Obsługa argumentów linii poleceń
const command = process.argv[2];

switch (command) {
  case 'setup':
    setupIpSettings();
    break;
  case 'status':
    showCurrentSettings();
    break;
  case 'reset':
    resetSettings();
    break;
  default:
    console.log("🛠️ Skrypt Zarządzania Ustawieniami Ograniczeń IP");
    console.log("===============================================");
    console.log("");
    console.log("Dostępne komendy:");
    console.log("  setup  - Skonfiguruj domyślne ustawienia ograniczeń IP");
    console.log("  status - Wyświetl obecne ustawienia");
    console.log("  reset  - Zresetuj ustawienia do domyślnych (DEV)");
    console.log("");
    console.log("Przykłady użycia:");
    console.log("  node setup-ip-settings.js setup");
    console.log("  node setup-ip-settings.js status");
    console.log("  node setup-ip-settings.js reset");
    console.log("");
    console.log("API Endpoints:");
    console.log("  GET    /api/ip-restrictions/settings");
    console.log("  PUT    /api/ip-restrictions/settings");
    console.log("  POST   /api/ip-restrictions/settings/toggle");
    break;
} 