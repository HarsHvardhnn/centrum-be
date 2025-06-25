const mongoose = require("mongoose");

const allowedIpSchema = new mongoose.Schema(
  {
    ipAddress: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: function(v) {
          // Sprawdź formaty IPv4 lub notację CIDR
          const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/([0-9]|[1-2][0-9]|3[0-2]))?$/;
          
          // Sprawdź format IPv6 (podstawowy)
          const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
          
          // Sprawdź specjalne nazwy hostów dla deweloperki
          const specialHosts = ['localhost', '0.0.0.0'];
          
          return ipv4Regex.test(v) || ipv6Regex.test(v) || specialHosts.includes(v);
        },
        message: 'Wprowadź prawidłowy adres IPv4, IPv6, notację CIDR lub localhost (np. 192.168.1.1, ::1, localhost, 192.168.1.0/24)'
      }
    },
    description: {
      type: String,
      required: true,
      maxlength: 200
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    lastUsed: {
      type: Date,
      default: null
    },
    usageCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Indeksy dla lepszej wydajności zapytań
allowedIpSchema.index({ ipAddress: 1 });
allowedIpSchema.index({ isActive: 1 });

// Metoda instancji do sprawdzania czy IP pasuje (obsługuje CIDR, IPv6, localhost)
allowedIpSchema.methods.matchesIp = function(clientIp) {
  const ipAddress = this.ipAddress;
  
  // Obsługa localhost - dopasowuje różne formaty localhost
  if (ipAddress === 'localhost') {
    return ['127.0.0.1', '::1', 'localhost'].includes(clientIp);
  }
  
  // Obsługa 0.0.0.0 - dopasowuje wszystkie lokalne interfejsy
  if (ipAddress === '0.0.0.0') {
    return ['127.0.0.1', '::1', 'localhost', '0.0.0.0'].includes(clientIp);
  }
  
  // Jeśli to pojedynczy IP (bez CIDR)
  if (!ipAddress.includes('/')) {
    return clientIp === ipAddress;
  }
  
  // Obsługa notacji CIDR dla IPv4
  const [networkIp, prefixLength] = ipAddress.split('/');
  const prefix = parseInt(prefixLength);
  
  // Sprawdź czy to IPv4 CIDR
  if (networkIp.includes('.')) {
    // Konwertuj IP na liczby całkowite do porównania
    const ipToInt = (ip) => {
      return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    };
    
    // Sprawdź czy client IP jest IPv4
    if (clientIp.includes('.')) {
      const clientIpInt = ipToInt(clientIp);
      const networkIpInt = ipToInt(networkIp);
      const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
      
      return (clientIpInt & mask) === (networkIpInt & mask);
    }
  }
  
  return false;
};

// Statyczna metoda do znajdowania pasującego IP
allowedIpSchema.statics.findMatchingIp = async function(clientIp) {
  const allowedIps = await this.find({ isActive: true });
  
  for (const allowedIp of allowedIps) {
    if (allowedIp.matchesIp(clientIp)) {
      // Aktualizuj statystyki użycia
      allowedIp.lastUsed = new Date();
      allowedIp.usageCount += 1;
      await allowedIp.save();
      return allowedIp;
    }
  }
  
  return null;
};

const AllowedIp = mongoose.model("AllowedIp", allowedIpSchema);

module.exports = AllowedIp; 