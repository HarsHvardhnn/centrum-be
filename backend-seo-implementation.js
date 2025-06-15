// Backend SEO Implementation for Your Existing Server
// This code can be integrated into your existing backend

const fs = require('fs');
const path = require('path');

// List of common crawler user agents
const CRAWLER_USER_AGENTS = [
  'Googlebot',
  'Bingbot', 
  'Slurp',
  'DuckDuckBot',
  'Baiduspider',
  'YandexBot',
  'facebookcatalog',
  'facebookexternalhit',
  'Twitterbot',
  'rogerbot',
  'LinkedInBot',
  'SitePreviewBot',
  'WhatsApp',
  'Applebot',
  'SkypeUriPreview',
  'Slack',
  'Discourse',
  'Pinterest',
  'Tumblr',
  'Telegram',
  'TelegramBot'
];

// Check if request is from a crawler/bot
function isCrawler(userAgent) {
  console.log("userAgent", userAgent);
  if (!userAgent) return false;
  
  return CRAWLER_USER_AGENTS.some(bot => 
    userAgent.toLowerCase().includes(bot.toLowerCase())
  );
}

// Generate SEO-optimized HTML for different routes
function generateSEOHTML(route, data = null) {
  const baseURL = 'https://centrummedyczne7.pl';
  
  // Default meta info
  const defaultMeta = {
    title: 'Centrum Medyczne 7 Skarżysko-Kamienna',
    description: 'Nowoczesna przychodnia w Skarżysku-Kamiennej. Doświadczeni lekarze specjaliści.',
    keywords: 'centrum medyczne, przychodnia, lekarze, Skarżysko-Kamienna',
    image: '/images/mainlogo.png',
    content: '<h1>Centrum Medyczne 7</h1><p>Nowoczesna przychodnia w Skarżysku-Kamiennej.</p>'
  };

  let meta = defaultMeta;

  console.log("route", route);
  // Handle different routes
  switch (route) {
    case '/':
      meta = {
        title: 'CM7 – Przychodnia specjalistyczna Skarżysko-Kamienna',
        description: 'Nowoczesna przychodnia w Skarżysku-Kamiennej. Doświadczeni lekarze specjaliści. Umów wizytę w Centrum Medyczne 7.',
        keywords: 'centrum medyczne 7, przychodnia Skarżysko-Kamienna, lekarze specjaliści, wizyta lekarska, opieka medyczna, cm7',
        image: '/images/mainlogo.png',
        content: `
          <h1>Centrum Medyczne 7 – Skarżysko-Kamienna</h1>
          <p>Nowoczesna przychodnia w Skarżysku-Kamiennej. Doświadczeni lekarze specjaliści.</p>
          <h2>Nasze usługi:</h2>
          <ul>
            <li>Konsultacja chirurgiczna</li>
            <li>Konsultacja online</li>
            <li>Konsultacja proktologiczna</li>
            <li>Leczenie ran przewlekłych</li>
            <li>Neurologia dziecięca</li>
          </ul>
          <p><strong>Kontakt:</strong> 797-097-487</p>
        `
      };
      break;

    case '/o-nas':
      meta = {
        title: 'O nas – Centrum Medyczne 7 Skarżysko-Kamienna | Kim jesteśmy',
        description: 'Poznaj Centrum Medyczne 7 w Skarżysku-Kamiennej. Nasza misja, wartości i zespół lekarzy, którym możesz zaufać.',
        keywords: 'o nas centrum medyczne 7, misja cm7, zespół lekarzy, wartości, Skarżysko-Kamienna',
        image: '/images/abt_us.jpg',
        content: `
          <h1>O nas – Centrum Medyczne 7</h1>
          <p>Poznaj Centrum Medyczne 7 w Skarżysku-Kamiennej. Nasza misja, wartości i zespół lekarzy, którym możesz zaufać.</p>
          <h2>Nasza misja</h2>
          <p>Zapewniamy profesjonalną opiekę medyczną mieszkańcom Skarżyska-Kamiennej i okolic.</p>
        `
      };
      break;

    case '/uslugi':
      meta = {
        title: 'Usługi medyczne – Centrum Medyczne 7 Skarżysko-Kamienna',
        description: 'Konsultacja chirurgiczna | Konsultacja online | Konsultacja proktologiczna | Leczenie ran przewlekłych | Neurologia dziecięca',
        keywords: 'usługi medyczne, konsultacja chirurgiczna, konsultacja online, proktologia, neurologia dziecięca, leczenie ran',
        image: '/images/uslugi.jpg',
        content: `
          <h1>Usługi medyczne – Centrum Medyczne 7</h1>
          <p>Oferujemy kompleksowe usługi medyczne w Skarżysku-Kamiennej.</p>
          <ul>
            <li>Konsultacja chirurgiczna</li>
            <li>Konsultacja online</li>
            <li>Konsultacja proktologiczna</li>
            <li>Leczenie ran przewlekłych</li>
            <li>Neurologia dziecięca</li>
          </ul>
        `
      };
      break;

    case '/kontakt':
      meta = {
        title: 'Kontakt – Centrum Medyczne 7 Skarżysko-Kamienna | Rejestracja i telefon',
        description: 'Zadzwoń: 797-097-487. Skontaktuj się z CM7 – telefon, e-mail, godziny otwarcia i rejestracja.',
        keywords: 'kontakt centrum medyczne 7, umów wizytę, telefon cm7, adres Skarżysko-Kamienna, godziny pracy',
        image: '/images/contact.jpg',
        content: `
          <h1>Kontakt – Centrum Medyczne 7</h1>
          <p><strong>Telefon:</strong> 797-097-487</p>
          <p><strong>Adres:</strong> Skarżysko-Kamienna</p>
          <p>Skontaktuj się z nami aby umówić wizytę.</p>
        `
      };
      break;

    case '/lekarze':
      meta = {
        title: 'Nasi lekarze – Centrum Medyczne 7 Skarżysko-Kamienna | Zespół specjalistów',
        description: 'Poznaj lekarzy CM7 w Skarżysku-Kamiennej. Doświadczeni specjaliści w różnych dziedzinach medycyny – sprawdź nasz zespół.',
        keywords: 'lekarze centrum medyczne 7, specjaliści medycyny, zespół lekarzy, doktorzy Skarżysko-Kamienna',
        image: '/images/doctors1.png',
        content: `
          <h1>Nasi lekarze – Centrum Medyczne 7</h1>
          <p>Poznaj lekarzy CM7 w Skarżysku-Kamiennej. Doświadczeni specjaliści w różnych dziedzinach medycyny.</p>
          <h2>Nasz zespół</h2>
          <p>Wykwalifikowani lekarze specjaliści gotowi do pomocy.</p>
        `
      };
      break;

    case '/aktualnosci':
      meta = {
        title: 'Aktualności – Centrum Medyczne 7 Skarżysko-Kamienna | Nowości i ogłoszenia',
        description: 'Bądź na bieżąco z informacjami w CM7. Ogłoszenia, zmiany godzin pracy, wydarzenia i komunikaty.',
        keywords: 'aktualności centrum medyczne 7, ogłoszenia medyczne, nowości cm7, komunikaty, wydarzenia medyczne',
        image: '/images/news.jpg',
        content: `
          <h1>Aktualności – Centrum Medyczne 7</h1>
          <p>Bądź na bieżąco z informacjami w CM7. Ogłoszenia, zmiany godzin pracy, wydarzenia i komunikaty.</p>
        `
      };
      break;

    case '/poradnik':
      meta = {
        title: 'CM7 – Artykuły i porady zdrowotne | Poradnik medyczny',
        description: 'Sprawdzone porady zdrowotne i artykuły medyczne od specjalistów CM7 w Skarżysku-Kamiennej. Praktyczna wiedza i wskazówki dla pacjentów.',
        keywords: 'poradnik zdrowia, porady medyczne, artykuły medyczne, profilaktyka, zdrowie, centrum medyczne 7',
        image: '/images/blogs.jpg',
        content: `
          <h1>Poradnik medyczny – Centrum Medyczne 7</h1>
          <p>Sprawdzone porady zdrowotne i artykuły medyczne od specjalistów CM7 w Skarżysku-Kamiennej.</p>
          <h2>Praktyczna wiedza</h2>
          <p>Wskazówki i porady dla pacjentów od naszych specjalistów.</p>
        `
      };
      break;

    default:
      // Handle dynamic routes
      if (route.startsWith('/aktualnosci/') && data) {
        meta = {
          title: `${data.title} | Aktualności – Centrum Medyczne 7`,
          description: data.shortDescription || 'Bądź na bieżąco z informacjami w CM7.',
          keywords: 'aktualności, centrum medyczne 7, news, ogłoszenia',
          image: data.image || '/images/news.jpg',
          content: `
            <h1>${data.title}</h1>
            <p>${data.shortDescription || data.description}</p>
          `
        };
      } else if (route.startsWith('/poradnik/') && data) {
        meta = {
          title: `${data.title} | Poradnik – Centrum Medyczne 7`,
          description: data.shortDescription || 'Sprawdzone porady zdrowotne i artykuły medyczne od specjalistów CM7.',
          keywords: 'poradnik, porady medyczne, zdrowie, centrum medyczne 7',
          image: data.image || '/images/blogs.jpg',
          content: `
            <h1>${data.title}</h1>
            <p>${data.shortDescription || data.description}</p>
          `
        };
      } else if (route.startsWith('/uslugi/') && data) {
        meta = {
          title: `${data.title} – Centrum Medyczne 7 Skarżysko-Kamienna`,
          description: data.shortDescription || 'Szczegółowy opis usługi medycznej w Centrum Medycznym 7.',
          keywords: 'usługi medyczne, centrum medyczne 7, ' + data.title,
          image: data.images?.[0] || '/images/uslugi.jpg',
          content: `
            <h1>${data.title}</h1>
            <p>${data.shortDescription || data.description}</p>
          `
        };
      }
      break;
  }

  // Generate complete HTML
  return `
<!doctype html>
<html lang="pl">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- SEO Meta Tags -->
    <title>${meta.title}</title>
    <meta name="description" content="${meta.description}" />
    <meta name="keywords" content="${meta.keywords}" />
    <meta name="author" content="Centrum Medyczne 7" />
    <link rel="canonical" href="${baseURL}${route}" />
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="${meta.title}" />
    <meta property="og:description" content="${meta.description}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${baseURL}${route}" />
    <meta property="og:image" content="${baseURL}${meta.image}" />
    <meta property="og:site_name" content="Centrum Medyczne 7" />
    <meta property="og:locale" content="pl_PL" />
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${meta.title}" />
    <meta name="twitter:description" content="${meta.description}" />
    <meta name="twitter:image" content="${baseURL}${meta.image}" />
    
    <!-- Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "MedicalOrganization",
      "name": "Centrum Medyczne 7",
      "alternateName": "CM7",
      "url": "${baseURL}",
      "logo": "${baseURL}/images/mainlogo.png",
      "description": "Profesjonalna klinika w Skarżysku-Kamiennej oferująca kompleksową opiekę medyczną",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Skarżysko-Kamienna",
        "addressRegion": "Świętokrzyskie",
        "addressCountry": "PL"
      }
    }
    </script>
</head>
<body>
    ${meta.content}
    
    <!-- This tells crawlers that the real content is at the same URL -->
    <noscript>
        <meta http-equiv="refresh" content="0; url=${baseURL}${route}" />
    </noscript>
</body>
</html>
  `;
}

// Main middleware function for your existing server
async function seoMiddleware(req, res, next) {
  const userAgent = req.headers['user-agent'] || '';
  const route = req.path;
  
  // Only handle GET requests for HTML content
  if (req.method !== 'GET') {
    return next();
  }
  
  // Skip API routes
  if (route.startsWith('/api') || route.startsWith('/auth')) {
    return next();
  }
  
  // Skip static files
  if (route.includes('.')) {
    return next();
  }
  
  // Check if this is a crawler
  if (isCrawler(userAgent)) {
    console.log(`🤖 Crawler detected: ${userAgent.substring(0, 50)}... for route: ${route}`);
    
    try {
      // For dynamic routes, fetch data from your database
      let data = null;
      
      // Fetch news data for news routes
      if (route.startsWith('/aktualnosci/')) {
        const slug = route.split('/aktualnosci/')[1];
        try {
          // Import your News model here
          const News = require('./models/news');
          data = await News.findOne({ slug }).lean();
        } catch (error) {
          console.error('Error fetching news data:', error);
        }
      }
      
      // Fetch blog/guide data for poradnik routes
      if (route.startsWith('/poradnik/')) {
        const slug = route.split('/poradnik/')[1];
        try {
          // Using News model for blog/poradnik content as well
          const News = require('./models/news');
          data = await News.findOne({ slug }).lean();
        } catch (error) {
          console.error('Error fetching blog data:', error);
        }
      }
      
      // Fetch service data for service routes  
      if (route.startsWith('/uslugi/')) {
        const serviceSlug = route.split('/uslugi/')[1];
        try {
          // Import your Service model here
          const Service = require('./models/services');
          data = await Service.findOne({ slug: serviceSlug }).lean();
        } catch (error) {
          console.error('Error fetching service data:', error);
        }
      }
      
      // Generate and return SEO-optimized HTML
      const seoHTML = generateSEOHTML(route, data);
      res.set('Content-Type', 'text/html');
      return res.send(seoHTML);
      
    } catch (error) {
      console.error('Error in SEO middleware:', error);
      // Fall back to regular handling if there's an error
      return next();
    }
  }
  
  // For regular users, continue to serve the React app
  next();
}

module.exports = {
  seoMiddleware,
  isCrawler,
  generateSEOHTML,
  CRAWLER_USER_AGENTS
}; 