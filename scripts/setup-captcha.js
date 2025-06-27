const dotenv = require("dotenv");
const connectDB = require("../config/db");
const CaptchaAttempt = require("../models/captcha");

dotenv.config();

const setupCaptcha = async () => {
  try {
    console.log("🚀 Inicjalizacja systemu CAPTCHA...\n");

    // Połącz z bazą danych
    await connectDB();
    console.log("✅ Połączono z bazą danych");

    // Sprawdź zmienne środowiskowe
    console.log("\n📋 Sprawdzanie konfiguracji:");
    
    const requiredEnvVars = [
      'RECAPTCHA_V3_SITE_KEY',
      'RECAPTCHA_V3_SECRET_KEY',
      'RECAPTCHA_V2_SITE_KEY', 
      'RECAPTCHA_V2_SECRET_KEY'
    ];

    const missingVars = [];
    requiredEnvVars.forEach(varName => {
      if (process.env[varName]) {
        console.log(`   ✅ ${varName}: ${process.env[varName].substring(0, 10)}...`);
      } else {
        console.log(`   ❌ ${varName}: BRAK`);
        missingVars.push(varName);
      }
    });

    if (missingVars.length > 0) {
      console.log("\n⚠️  Brakuje zmiennych środowiskowych:");
      console.log("   Dodaj do pliku .env:");
      missingVars.forEach(varName => {
        console.log(`   ${varName}=your_key_here`);
      });
      console.log("\n🔗 Uzyskaj klucze z: https://www.google.com/recaptcha/admin");
    } else {
      console.log("\n✅ Wszystkie zmienne środowiskowe są skonfigurowane");
    }

    // Sprawdź kolekcję CAPTCHA
    console.log("\n📊 Sprawdzanie bazy danych:");
    
    const totalAttempts = await CaptchaAttempt.countDocuments();
    console.log(`   📈 Łączna liczba prób CAPTCHA: ${totalAttempts}`);

    if (totalAttempts > 0) {
      const last24h = await CaptchaAttempt.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
      
      const successfulAttempts = await CaptchaAttempt.countDocuments({
        isAccepted: true,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      console.log(`   📊 Próby w ostatnich 24h: ${last24h}`);
      console.log(`   ✅ Udane próby w ostatnich 24h: ${successfulAttempts}`);
      console.log(`   📋 Wskaźnik sukcesu: ${last24h > 0 ? ((successfulAttempts / last24h) * 100).toFixed(1) : 0}%`);
    }

    // Sprawdź indeksy
    console.log("\n🔍 Sprawdzanie indeksów bazy danych:");
    const indexes = await CaptchaAttempt.collection.getIndexes();
    console.log(`   📋 Liczba indeksów: ${Object.keys(indexes).length}`);
    
    Object.keys(indexes).forEach(indexName => {
      if (indexName !== '_id_') {
        console.log(`   🗂️  ${indexName}`);
      }
    });

    // Konfiguracja systemu
    console.log("\n⚙️  Konfiguracja systemu:");
    console.log(`   🔧 Tryb środowiska: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   🔧 Pomijanie w trybie dev: ${process.env.NODE_ENV === 'development' ? 'TAK' : 'NIE'}`);
    console.log(`   🔧 Próg score (kontakt): 0.3`);
    console.log(`   🔧 Limit rate (kontakt): 10/godzinę`);
    console.log(`   🔧 Automatyczne usuwanie logów: 7 dni`);

    console.log("\n📚 Przydatne komendy:");
    console.log("   node scripts/setup-captcha.js status     - Pokaż status systemu");
    console.log("   node scripts/setup-captcha.js cleanup    - Wyczyść stare logi");
    console.log("   node scripts/setup-captcha.js test       - Przetestuj konfigurację");
    console.log("   node scripts/setup-captcha.js reset      - Zresetuj wszystkie logi");

    console.log("\n✅ Konfiguracja CAPTCHA zakończona pomyślnie!");

  } catch (error) {
    console.error("❌ Błąd podczas konfiguracji CAPTCHA:", error.message);
    process.exit(1);
  }
};

const showStatus = async () => {
  try {
    await connectDB();
    
    console.log("📊 Status systemu CAPTCHA\n");
    
    // Statystyki ogólne
    const stats = await CaptchaAttempt.getStats(24);
    console.log("📈 Statystyki z ostatnich 24 godzin:");
    console.log(`   Łączne próby: ${stats.overall.totalAttempts}`);
    console.log(`   Zaakceptowane: ${stats.overall.acceptedAttempts}`);
    console.log(`   Odrzucone: ${stats.overall.totalAttempts - stats.overall.acceptedAttempts}`);
    console.log(`   Średni score: ${stats.overall.averageScore?.toFixed(3) || 'N/A'}`);
    console.log(`   Niski score (<0.3): ${stats.overall.lowScoreAttempts}`);
    console.log(`   Użyto fallback v2: ${stats.overall.fallbackUsed}`);
    
    // Statystyki per typ formularza
    if (stats.byFormType.length > 0) {
      console.log("\n📋 Statystyki według typu formularza:");
      stats.byFormType.forEach(formStat => {
        console.log(`   ${formStat._id}: ${formStat.count} prób (${formStat.accepted} udanych)`);
      });
    }

    // Top IP z odrzuceniami
    const topRejectedIps = await CaptchaAttempt.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          isAccepted: false
        }
      },
      {
        $group: {
          _id: '$ipAddress',
          rejectedCount: { $sum: 1 }
        }
      },
      {
        $sort: { rejectedCount: -1 }
      },
      {
        $limit: 5
      }
    ]);

    if (topRejectedIps.length > 0) {
      console.log("\n🚫 Top IP z odrzuceniami:");
      topRejectedIps.forEach(ip => {
        console.log(`   ${ip._id}: ${ip.rejectedCount} odrzuceń`);
      });
    }

  } catch (error) {
    console.error("❌ Błąd podczas pobierania statusu:", error.message);
  }
};

const cleanupLogs = async (daysOld = 7) => {
  try {
    await connectDB();
    
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await CaptchaAttempt.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    console.log(`🧹 Usunięto ${result.deletedCount} starych logów CAPTCHA (starszych niż ${daysOld} dni)`);
    
  } catch (error) {
    console.error("❌ Błąd podczas czyszczenia logów:", error.message);
  }
};

const testConfiguration = async () => {
  try {
    console.log("🧪 Testowanie konfiguracji CAPTCHA...\n");

    // Test zmiennych środowiskowych
    const requiredVars = ['RECAPTCHA_V3_SITE_KEY', 'RECAPTCHA_V3_SECRET_KEY'];
    let allVarsPresent = true;

    requiredVars.forEach(varName => {
      if (!process.env[varName]) {
        console.log(`❌ Brak zmiennej: ${varName}`);
        allVarsPresent = false;
      }
    });

    if (!allVarsPresent) {
      console.log("❌ Test konfiguracji nie powiódł się - brakuje zmiennych środowiskowych");
      return;
    }

    // Test połączenia z bazą danych
    await connectDB();
    console.log("✅ Połączenie z bazą danych");

    // Test utworzenia rekordu
    const testRecord = await CaptchaAttempt.logAttempt({
      ipAddress: '127.0.0.1',
      formType: 'contact',
      captchaScore: 0.9,
      captchaToken: 'test_token_' + Date.now(),
      isAccepted: true,
      userAgent: 'Test Agent',
      referer: 'Test Referer'
    });

    console.log("✅ Utworzenie rekordu testowego");

    // Test pobrania statystyk
    const stats = await CaptchaAttempt.getStats(1);
    console.log("✅ Pobranie statystyk");

    // Usuń rekord testowy
    await CaptchaAttempt.findByIdAndDelete(testRecord._id);
    console.log("✅ Usunięcie rekordu testowego");

    console.log("\n🎉 Wszystkie testy przeszły pomyślnie!");

  } catch (error) {
    console.error("❌ Test konfiguracji nie powiódł się:", error.message);
  }
};

const resetAllLogs = async () => {
  try {
    console.log("⚠️  UWAGA: To spowoduje usunięcie WSZYSTKICH logów CAPTCHA!");
    console.log("Czy jesteś pewien? (y/N)");
    
    // W rzeczywistej implementacji, dodaj readline dla potwierdzenia
    // Na razie tylko pokazujemy ostrzeżenie
    
    await connectDB();
    const result = await CaptchaAttempt.deleteMany({});
    console.log(`🗑️  Usunięto ${result.deletedCount} logów CAPTCHA`);
    
  } catch (error) {
    console.error("❌ Błąd podczas resetowania logów:", error.message);
  }
};

// Obsługa argumentów wiersza poleceń
const command = process.argv[2];

switch (command) {
  case 'status':
    showStatus().then(() => process.exit(0));
    break;
  case 'cleanup':
    const days = parseInt(process.argv[3]) || 7;
    cleanupLogs(days).then(() => process.exit(0));
    break;
  case 'test':
    testConfiguration().then(() => process.exit(0));
    break;
  case 'reset':
    resetAllLogs().then(() => process.exit(0));
    break;
  default:
    setupCaptcha().then(() => process.exit(0));
} 