const mongoose = require("mongoose");
const AllowedIp = require("../models/allowedIp");
const User = require("../models/user-entity/user");
const connectDB = require("../config/db");
require("dotenv").config();

/**
 * Skrypt konfiguracji ograniczeń IP
 * Ten skrypt inicjalizuje system ograniczeń IP z domyślnymi dozwolonymi adresami IP
 */
const setupIpRestrictions = async () => {
  try {
    console.log("🔧 Konfigurowanie ograniczeń IP...");
    
    // Połączenie z bazą danych
    await connectDB();
    console.log("✅ Połączono z bazą danych");

    // Znajdź użytkownika admin (wymagane dla pola createdBy)
    const adminUser = await User.findOne({ role: "admin" });
    if (!adminUser) {
      console.error("❌ Nie znaleziono użytkownika admin. Uruchom najpierw seeder admina.");
      process.exit(1);
    }

    // Domyślne dozwolone adresy IP do dodania
    const defaultAllowedIps = [
      {
        ipAddress: "127.0.0.1",
        description: "Localhost IPv4 - Serwer deweloperski",
        isActive: true,
        createdBy: adminUser._id
      },
      {
        ipAddress: "::1",
        description: "Localhost IPv6 - Serwer deweloperski",
        isActive: true,
        createdBy: adminUser._id
      },
      {
        ipAddress: "localhost",
        description: "Localhost - Nazwa hosta deweloperskiego",
        isActive: true,
        createdBy: adminUser._id
      },
      {
        ipAddress: "0.0.0.0",
        description: "Wszystkie interfejsy IPv4 - Deweloperski",
        isActive: true,
        createdBy: adminUser._id
      },
      {
        ipAddress: "192.168.1.0/24",
        description: "Zakres sieci lokalnej - Typowa sieć domowa/biurowa",
        isActive: false, // Wyłączone domyślnie ze względów bezpieczeństwa
        createdBy: adminUser._id
      },
      {
        ipAddress: "192.168.0.0/24",
        description: "Alternatywny zakres sieci lokalnej - Sieć domowa/biurowa",
        isActive: false, // Wyłączone domyślnie ze względów bezpieczeństwa
        createdBy: adminUser._id
      },
      {
        ipAddress: "10.0.0.0/8",
        description: "Zakres sieci prywatnej - Sieci korporacyjne",
        isActive: false, // Wyłączone domyślnie ze względów bezpieczeństwa
        createdBy: adminUser._id
      },
      {
        ipAddress: "172.16.0.0/12",
        description: "Zakres sieci prywatnej - Sieci korporacyjne (172.16-172.31)",
        isActive: false, // Wyłączone domyślnie ze względów bezpieczeństwa
        createdBy: adminUser._id
      }
    ];

    // Dodaj swój obecny IP (jeśli uruchamiasz z określonej lokalizacji)
    // Możesz tutaj ręcznie dodać IP swojego serwera produkcyjnego
    // Przykład:
    // {
    //   ipAddress: "TWÓJ_IP_PRODUKCYJNY",
    //   description: "Dostęp do serwera produkcyjnego",
    //   isActive: true,
    //   createdBy: adminUser._id
    // }

    let addedCount = 0;
    let skippedCount = 0;

    for (const ipData of defaultAllowedIps) {
      // Sprawdź czy IP już istnieje
      const existingIp = await AllowedIp.findOne({ ipAddress: ipData.ipAddress });
      
      if (existingIp) {
        console.log(`⏩ Pomijanie istniejącego IP: ${ipData.ipAddress}`);
        skippedCount++;
        continue;
      }

      // Utwórz nowy dozwolony IP
      const newAllowedIp = new AllowedIp(ipData);
      await newAllowedIp.save();
      
      console.log(`✅ Dodano IP: ${ipData.ipAddress} - ${ipData.description}`);
      addedCount++;
    }

    console.log("\n📊 Podsumowanie konfiguracji:");
    console.log(`✅ Dodano: ${addedCount} adresów IP`);
    console.log(`⏩ Pominięto: ${skippedCount} istniejących adresów IP`);
    
    // Wyświetl obecny status
    const totalIps = await AllowedIp.countDocuments();
    const activeIps = await AllowedIp.countDocuments({ isActive: true });
    
    console.log(`📈 Łącznie IP w systemie: ${totalIps}`);
    console.log(`🟢 Aktywne IP: ${activeIps}`);
    console.log(`🔴 Nieaktywne IP: ${totalIps - activeIps}`);

    console.log("\n🔒 Uwaga dotycząca bezpieczeństwa:");
    console.log("- Niektóre zakresy IP są domyślnie wyłączone ze względów bezpieczeństwa");
    console.log("- Włącz tylko te IP, których potrzebujesz przez panel admina");
    console.log("- Rozważ dodanie konkretnego IP swojego serwera produkcyjnego");
    console.log("- Dokładnie przetestuj ograniczenia IP przed włączeniem w produkcji");

    console.log("\n🚀 Następne kroki:");
    console.log("1. Uzyskaj dostęp do panelu admina: /api/ip-restrictions");
    console.log("2. Dodaj IP swojego serwera produkcyjnego");
    console.log("3. Włącz tylko te IP, których potrzebujesz");
    console.log("4. Przetestuj funkcjonalność ograniczeń");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Błąd podczas konfigurowania ograniczeń IP:", error);
    process.exit(1);
  }
};

/**
 * Reset ograniczeń IP (dla rozwoju/testowania)
 */
const resetIpRestrictions = async () => {
  try {
    console.log("🔄 Resetowanie ograniczeń IP...");
    
    await connectDB();
    console.log("✅ Połączono z bazą danych");

    const deleteResult = await AllowedIp.deleteMany({});
    console.log(`🗑️ Usunięto ${deleteResult.deletedCount} adresów IP`);
    
    console.log("✅ Ograniczenia IP zostały pomyślnie zresetowane");
    process.exit(0);
  } catch (error) {
    console.error("❌ Błąd podczas resetowania ograniczeń IP:", error);
    process.exit(1);
  }
};

/**
 * Wyświetl obecny status ograniczeń IP
 */
const showIpStatus = async () => {
  try {
    console.log("📊 Obecny Status Ograniczeń IP");
    console.log("=".repeat(40));
    
    await connectDB();
    
    const allIps = await AllowedIp.find()
      .populate('createdBy', 'name.first name.last email')
      .sort({ createdAt: -1 });

    if (allIps.length === 0) {
      console.log("📭 Brak skonfigurowanych ograniczeń IP");
      process.exit(0);
    }

    allIps.forEach((ip, index) => {
      const status = ip.isActive ? "🟢 AKTYWNY" : "🔴 NIEAKTYWNY";
      console.log(`\n${index + 1}. ${status}`);
      console.log(`   IP: ${ip.ipAddress}`);
      console.log(`   Opis: ${ip.description}`);
      console.log(`   Utworzono: ${ip.createdAt.toLocaleDateString()}`);
      console.log(`   Ostatnie użycie: ${ip.lastUsed ? ip.lastUsed.toLocaleDateString() : 'Nigdy'}`);
      console.log(`   Liczba użyć: ${ip.usageCount}`);
    });

    const stats = await AllowedIp.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
          totalUsage: { $sum: '$usageCount' }
        }
      }
    ]);

    if (stats[0]) {
      console.log("\n📈 Podsumowanie:");
      console.log(`   Łącznie IP: ${stats[0].total}`);
      console.log(`   Aktywne: ${stats[0].active}`);
      console.log(`   Nieaktywne: ${stats[0].total - stats[0].active}`);
      console.log(`   Łączne użycie: ${stats[0].totalUsage}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Błąd podczas wyświetlania statusu IP:", error);
    process.exit(1);
  }
};

// Obsługa argumentów linii poleceń
const command = process.argv[2];

switch (command) {
  case 'setup':
    setupIpRestrictions();
    break;
  case 'reset':
    resetIpRestrictions();
    break;
  case 'status':
    showIpStatus();
    break;
  default:
    console.log("🛠️ Skrypt Zarządzania Ograniczeniami IP");
    console.log("=====================================");
    console.log("");
    console.log("Dostępne komendy:");
    console.log("  setup  - Konfiguruj ograniczenia IP z domyślnymi wartościami");
    console.log("  reset  - Usuń wszystkie ograniczenia IP (DEV)");
    console.log("  status - Wyświetl obecny status ograniczeń IP");
    console.log("");
    console.log("Przykłady użycia:");
    console.log("  node setup-ip-restrictions.js setup");
    console.log("  node setup-ip-restrictions.js status");
    console.log("  node setup-ip-restrictions.js reset");
    break;
} 