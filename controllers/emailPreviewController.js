const sendEmail = require("../utils/mailer");
const { formatDateForSMS, formatTimeForSMS } = require("../utils/dateUtils");
const { getIconImg } = require("../utils/emailIcons");
const path = require("path");
const fs = require("fs");

/**
 * Email Preview Controller
 * Sends all email templates to a specified email for preview
 */

// Helper functions to process HTML email templates - using embedded templates
// Shared CSS for all email templates (converted from Tailwind to regular CSS)
const emailCSS = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      body {
        margin: 0;
        padding: 0;
        font-family: 'Inter', sans-serif;
        background-color: #ffffff;
        color: #0f1419;
      }
      
      ::-webkit-scrollbar {
        display: none;
      }
      
      /* Utility Classes */
      .bg-white { background-color: #ffffff; }
      .bg-gray-50 { background-color: #f9fafb; }
      .bg-gray-100 { background-color: #f3f4f6; }
      .bg-emerald-50 { background-color: #ecfdf5; }
      .bg-blue-50 { background-color: #eff6ff; }
      .bg-yellow-50 { background-color: #fefce8; }
      .bg-red-50 { background-color: #fef2f2; }
      .bg-orange-50 { background-color: #fff7ed; }
      .bg-green-50 { background-color: #f0fdf4; }
      .bg-teal-50 { background-color: #f0fdfa; }
      
      .text-white { color: #ffffff; }
      .text-gray-400 { color: #9ca3af; }
      .text-gray-500 { color: #6b7280; }
      .text-gray-600 { color: #4b5563; }
      .text-gray-700 { color: #374151; }
      .text-navy { color: #1e3a8a; }
      .text-deep-navy { color: #0f1419; }
      .text-teal-custom { color: #008C8C; }
      .text-success-green { color: #16a34a; }
      .text-warning-red { color: #dc2626; }
      .text-warning-orange { color: #f97316; }
      
      .font-inter { font-family: 'Inter', sans-serif; }
      .font-medium { font-weight: 500; }
      .font-semibold { font-weight: 600; }
      .font-bold { font-weight: 700; }
      
      .text-xs { font-size: 0.75rem; line-height: 1rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
      .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
      .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
      .text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
      
      .uppercase { text-transform: uppercase; }
      .tracking-wide { letter-spacing: 0.025em; }
      .tracking-wider { letter-spacing: 0.05em; }
      .leading-relaxed { line-height: 1.625; }
      .line-through { text-decoration: line-through; }
      
      .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
      .px-8 { padding-left: 2rem; padding-right: 2rem; }
      .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
      .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
      .py-5 { padding-top: 1.25rem; padding-bottom: 1.25rem; }
      .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
      .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
      .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
      
      .mx-8 { margin-left: 2rem; margin-right: 2rem; }
      .my-8 { margin-top: 2rem; margin-bottom: 2rem; }
      .mb-2 { margin-bottom: 0.5rem; }
      .mb-4 { margin-bottom: 1rem; }
      .mb-6 { margin-bottom: 1.5rem; }
      .mb-8 { margin-bottom: 2rem; }
      .mt-1 { margin-top: 0.25rem; }
      .mt-4 { margin-top: 1rem; }
      
      .flex { display: flex; }
      .items-center { align-items: center; }
      .items-start { align-items: flex-start; }
      .justify-between { justify-content: space-between; }
      .justify-center { justify-content: center; }
      
      .gap-3 { gap: 0.75rem; }
      .gap-4 { gap: 1rem; }
      .gap-6 { gap: 1.5rem; }
      
      .border-b { border-bottom-width: 1px; }
      .border-t { border-top-width: 1px; }
      .border-gray-100 { border-color: #f3f4f6; }
      .border-teal-100 { border-color: #ccfbf1; }
      
      .rounded-lg { border-radius: 0.5rem; }
      .rounded-full { border-radius: 9999px; }
      
      .text-center { text-align: center; }
      
      .max-w-680 { max-width: 680px; }
      .mx-auto { margin-left: auto; margin-right: auto; }
      
      .w-5 { width: 1.25rem; }
      .w-8 { width: 2rem; }
      .w-32 { width: 8rem; }
      .h-8 { height: 2rem; }
      
      .space-y-2 > * + * { margin-top: 0.5rem; }
      .space-y-4 > * + * { margin-top: 1rem; }
      .space-y-5 > * + * { margin-top: 1.25rem; }
      
      .grid { display: grid; }
      .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
      
      @media (min-width: 768px) {
        .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .max-w-md { max-width: 28rem; }
      }
      
      /* Mobile Responsive Styles */
      @media (max-width: 600px) {
        .px-8 { padding-left: 1rem; padding-right: 1rem; }
        .px-6 { padding-left: 1rem; padding-right: 1rem; }
        .py-12 { padding-top: 2rem; padding-bottom: 2rem; }
        .py-8 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
        .py-6 { padding-top: 1rem; padding-bottom: 1rem; }
        .mx-8 { margin-left: 1rem; margin-right: 1rem; }
        .text-3xl { font-size: 1.5rem; line-height: 2rem; }
        .text-xl { font-size: 1.125rem; line-height: 1.75rem; }
        .text-lg { font-size: 1rem; line-height: 1.5rem; }
        .w-32 { width: 6rem; min-width: 6rem; }
        .gap-4 { gap: 0.75rem; }
        .flex { flex-wrap: wrap; }
        #email-container { max-width: 100% !important; }
        .space-y-5 > * + * { margin-top: 0.75rem; }
      }
      
      a {
        color: inherit;
        text-decoration: underline;
      }
      
      img {
        max-width: 100%;
        height: auto;
      }
    `;

const processCancellationEmail = (data) => {
  // Access the internal function - we need to export it or use a different approach
  // For now, let's create a shared module or just duplicate the templates
  // Actually, let's just use the same logic but we can't access private functions
  // So we'll duplicate the templates here
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';
  const { patientName, doctorName, date, time, mode } = data;
  const consultationType = mode === 'online' ? 'Online' : 'Stacjonarna';
  
  // Same template as appointmentController - cancellation email
  return appointmentController.createCancellationEmailHtml ? 
    appointmentController.createCancellationEmailHtml(data) :
    createCancellationEmailDirect(data);
};

const createCancellationEmailDirect = (data) => {
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';
  const { patientName, doctorName, date, time, mode } = data;
  const consultationType = mode === 'online' ? 'Online' : 'Stacjonarna';
  
  // Full cancellation template - same as in appointmentController
  return `<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Odwołanie wizyty</title>
    <script>window.FontAwesomeConfig = { autoReplaceSvg: 'nest' };</script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
    <style>${emailCSS}</style>
  </head>
  <body class="bg-white font-inter">
    <div id="email-container" class="max-w-680 mx-auto bg-white" style="max-width: 680px;">
      <header id="header" class="px-8 py-4 border-b border-gray-100">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <img src="${logoUrl}" alt="Centrum Medyczne 7 Logo" style="height: 50px; width: auto;" />
            <div class="text-lg font-semibold text-navy">Centrum Medyczne 7</div>
          </div>
          <div class="text-xs text-gray-500 uppercase tracking-wider">automatyczny system powiadomień</div>
        </div>
      </header>
      <section id="title-section" class="px-8 py-12 text-center">
        <div class="flex justify-center mb-6"><i class="fa-solid fa-calendar-xmark text-4xl text-warning-red"></i></div>
        <h1 class="text-3xl font-bold text-navy mb-4">Odwołanie wizyty</h1>
        <p class="text-lg text-gray-600 leading-relaxed max-w-md mx-auto">
          Informujemy, że Twoja wizyta została odwołana. Poniżej znajdziesz szczegóły dotyczące anulowanej konsultacji oraz dalsze instrukcje.
        </p>
      </section>
      <section id="cancellation-notice" class="mx-8 mb-8 px-6 py-5 bg-red-50 rounded-lg">
        <div class="flex items-start gap-4"><i class="fa-solid fa-circle-exclamation text-lg text-warning-red mt-1"></i>
          <div>
            <p class="text-deep-navy font-medium mb-2">Wizyta została odwołana</p>
            <p class="text-deep-navy leading-relaxed">
              Twoja wizyta została anulowana z przyczyn organizacyjnych lub na prośbę pacjenta. W celu umówienia nowego terminu prosimy o kontakt telefoniczny z recepcją.
            </p>
          </div>
        </div>
      </section>
      <section id="appointment-details" class="px-8 py-8">
        <div class="flex items-center gap-3 mb-8"><i class="fa-solid fa-clipboard-list text-xl text-teal-custom"></i>
          <h2 class="text-xl font-bold text-navy">Szczegóły odwołanej wizyty</h2>
        </div>
        <div class="space-y-5">
          <div class="flex items-center gap-4 py-4 border-b border-gray-100"><i class="fa-solid fa-user text-teal-custom w-5"></i><span class="text-sm text-gray-500 uppercase tracking-wide w-32">Pacjent</span><span class="text-deep-navy font-medium">${patientName}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100"><i class="fa-solid fa-user-doctor text-teal-custom w-5"></i><span class="text-sm text-gray-500 uppercase tracking-wide w-32">Lekarz prowadzący</span><span class="text-deep-navy font-medium">${doctorName}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100"><i class="fa-solid fa-calendar text-teal-custom w-5"></i><span class="text-sm text-gray-500 uppercase tracking-wide w-32">Data</span><span class="text-deep-navy font-medium line-through text-gray-500">${date}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100"><i class="fa-solid fa-clock text-teal-custom w-5"></i><span class="text-sm text-gray-500 uppercase tracking-wide w-32">Godzina</span><span class="text-deep-navy font-medium line-through text-gray-500">${time}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100"><i class="fa-solid fa-stethoscope text-teal-custom w-5"></i><span class="text-sm text-gray-500 uppercase tracking-wide w-32">Forma konsultacji</span><span class="text-deep-navy font-medium">${consultationType}</span></div>
          <div class="flex items-start gap-4 py-4"><i class="fa-solid fa-location-dot text-teal-custom w-5 mt-1"></i><span class="text-sm text-gray-500 uppercase tracking-wide w-32">Adres</span><span class="text-deep-navy font-medium">Centrum Medyczne 7<br>ul. Powstańców Warszawy 7/1.5<br>26-110 Skarżysko-Kamienna</span></div>
        </div>
      </section>
      <section id="next-steps-section" class="mx-8 my-8 px-6 py-6 bg-blue-50 rounded-lg">
        <div class="flex items-start gap-4"><i class="fa-solid fa-calendar-plus text-lg text-teal-custom mt-1"></i>
          <div>
            <p class="text-navy font-medium mb-2">Umówienie nowego terminu</p>
            <p class="text-deep-navy leading-relaxed">
              Aby umówić się na nowy termin wizyty, skontaktuj się z nami telefonicznie lub przez naszą stronę internetową.<br>
              Nasz zespół pomoże Ci znaleźć dogodny termin w najbliższym możliwym czasie.
            </p>
          </div>
        </div>
      </section>
      <section id="important-notice" class="mx-8 my-8 px-6 py-6 bg-yellow-50 rounded-lg">
        <div class="flex items-start gap-4"><i class="fa-solid fa-triangle-exclamation text-lg text-warning-orange mt-1"></i>
          <div>
            <p class="text-navy font-medium mb-2">Ważne informacje</p>
            <p class="text-deep-navy leading-relaxed">
              W przypadku gdy wizyta nie została odwołana z Państwa inicjatywy ani nie przekazano wcześniej takiej informacji telefonicznie, prosimy o niezwłoczny kontakt z rejestracją w celu potwierdzenia statusu wizyty. Informacja o odwołaniu mogła zostać wygenerowana automatycznie w wyniku błędu systemowego lub nieprawidłowej synchronizacji danych.
            </p>
          </div>
        </div>
      </section>
      <section id="contact-section" class="px-8 py-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="flex items-center gap-3"><i class="fa-solid fa-phone text-teal-custom"></i>
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Telefon</div>
              <div class="font-medium text-deep-navy">+48 797 127 487</div>
            </div>
          </div>
          <div class="flex items-center gap-3"><i class="fa-solid fa-envelope text-teal-custom"></i>
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Email</div>
              <div class="font-medium text-deep-navy">kontakt@centrummedyczne7.pl</div>
            </div>
          </div>
        </div>
      </section>
      <section id="privacy-section" class="px-8 py-6 border-t border-gray-100">
        <p class="text-xs text-gray-500 leading-relaxed">
          Niniejsza wiadomość zawiera informacje medyczne podlegające ochronie prawnej. Jeśli nie jesteś właściwym odbiorcą, prosimy o niezwłoczne usunięcie wiadomości i poinformowanie nadawcy. Centrum Medyczne 7 dołożyło wszelkich starań, aby zapewnić bezpieczeństwo transmisji danych.
        </p>
      </section>
      <footer id="footer" class="px-8 py-8 bg-gray-50 text-center">
        <div class="space-y-2">
          <div class="text-sm text-gray-600 font-medium">© 2025 Centrum Medyczne 7</div>
          <div class="text-xs text-gray-400 mt-4">Ta wiadomość została wygenerowana automatycznie. Prosimy nie odpowiadać na ten e-mail.<br>Administratorem danych osobowych jest CM7 Sp. z o.o. Szczegółowe informacje na temat przetwarzania danych osobowych znajdują się w&nbsp;<a href="https://centrummedyczne7.pl/polityka-prywatnosci">Polityce Prywatności</a>.</div>
        </div>
      </footer>
    </div>
  </body>
</html>`;
};

const processRescheduleEmail = (data) => {
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';
  const { patientName, doctorName, oldDate, oldTime, newDate, newTime, mode } = data;
  const consultationType = mode === 'online' ? 'Online' : 'Stacjonarna';
  
  // Full reschedule template
  return `<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Przełożenie wizyty</title>
    <script>window.FontAwesomeConfig = { autoReplaceSvg: 'nest' };</script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
    <style>${emailCSS}</style>
  </head>
  <body class="bg-white font-inter">
    <div id="email-container" class="max-w-680 mx-auto bg-white" style="max-width: 680px;">
      <header id="header" class="px-8 py-4 border-b border-gray-100">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <img src="${logoUrl}" alt="Centrum Medyczne 7 Logo" style="height: 50px; width: auto;" />
            <div class="text-lg font-semibold text-navy">Centrum Medyczne 7</div>
          </div>
          <div class="text-xs text-gray-500 uppercase tracking-wider">automatyczny system powiadomień</div>
        </div>
      </header>
      <section id="title-section" class="px-8 py-12 text-center">
        <div class="flex justify-center mb-6"><i class="fa-solid fa-calendar-xmark text-4xl text-warning-orange"></i></div>
        <h1 class="text-3xl font-bold text-navy mb-4">Przełożenie wizyty</h1>
        <p class="text-lg text-gray-600 leading-relaxed max-w-md mx-auto">
          Informujemy, że Twoja wizyta została przełożona na inny termin. Poniżej znajdziesz szczegóły.&nbsp;</p>
      </section>
      <section id="postponement-notice" class="mx-8 mb-8 px-6 py-5 bg-orange-50 rounded-lg">
        <div class="flex items-start gap-4"><i class="fa-solid fa-triangle-exclamation text-lg text-warning-orange mt-1"></i>
          <div>
            <p class="text-deep-navy leading-relaxed">W przypadku gdy wizyta nie została przełożona z Państwa inicjatywy ani nie przekazano wcześniej takiej informacji telefonicznie, prosimy o niezwłoczny kontakt z rejestracją w celu potwierdzenia statusu wizyty. Informacja o przełożeniu wizyty mogła zostać wygenerowana automatycznie w wyniku błędu systemowego lub nieprawidłowej synchronizacji danych.</p>
          </div>
        </div>
      </section>
      <section id="original-appointment" class="px-8 py-6">
        <div class="flex items-center gap-3 mb-6"><i class="fa-solid fa-calendar-minus text-xl text-gray-400"></i>
          <h2 class="text-xl font-bold text-navy">Pierwotny termin wizyty</h2>
        </div>
        <div class="bg-gray-50 rounded-lg p-6 space-y-4">
          <div class="flex items-center gap-4 py-3"><i class="fa-solid fa-user text-gray-400 w-5"></i><span class="text-sm text-gray-500 uppercase tracking-wide w-32">Pacjent</span><span class="text-gray-700 font-medium">${patientName}</span></div>
          <div class="flex items-center gap-4 py-3"><i class="fa-solid fa-user-doctor text-gray-400 w-5"></i><span class="text-sm text-gray-500 uppercase tracking-wide w-32">Lekarz prowadzący</span><span class="text-gray-700 font-medium">${doctorName}</span></div>
          <div class="flex items-center gap-4 py-3"><i class="fa-solid fa-calendar text-gray-400 w-5"></i><span class="text-sm text-gray-500 uppercase tracking-wide w-32">Data</span><span class="text-gray-700 font-medium line-through">${oldDate}</span></div>
          <div class="flex items-center gap-4 py-3"><i class="fa-solid fa-clock text-gray-400 w-5"></i><span class="text-sm text-gray-500 uppercase tracking-wide w-32">Godzina</span><span class="text-gray-700 font-medium line-through">${oldTime}</span></div>
        </div>
      </section>
      <section id="new-appointment-details" class="px-8 py-8">
        <div class="flex items-center gap-3 mb-8"><i class="fa-solid fa-calendar-plus text-xl text-teal-custom"></i>
          <h2 class="text-xl font-bold text-navy">Nowy termin wizyty</h2>
        </div>
        <div class="bg-teal-50 rounded-lg p-6 space-y-5">
          <div class="flex items-center gap-4 py-4 border-b border-teal-100"><i class="fa-solid fa-user text-teal-custom w-5"></i><span class="text-sm text-gray-600 uppercase tracking-wide w-32">Pacjent</span><span class="text-deep-navy font-medium">${patientName}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-teal-100"><i class="fa-solid fa-user-doctor text-teal-custom w-5"></i><span class="text-sm text-gray-600 uppercase tracking-wide w-32">Lekarz prowadzący</span><span class="text-deep-navy font-medium">${doctorName}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-teal-100"><i class="fa-solid fa-calendar text-teal-custom w-5"></i><span class="text-sm text-gray-600 uppercase tracking-wide w-32">Nowa data</span><span class="text-deep-navy font-bold">${newDate}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-teal-100"><i class="fa-solid fa-clock text-teal-custom w-5"></i><span class="text-sm text-gray-600 uppercase tracking-wide w-32">Nowa godzina</span><span class="text-deep-navy font-bold">${newTime}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-teal-100"><i class="fa-solid fa-stethoscope text-teal-custom w-5"></i><span class="text-sm text-gray-600 uppercase tracking-wide w-32">Forma konsultacji</span><span class="text-deep-navy font-medium">${consultationType}</span></div>
          <div class="flex items-start gap-4 py-4"><i class="fa-solid fa-location-dot text-teal-custom w-5 mt-1"></i><span class="text-sm text-gray-600 uppercase tracking-wide w-32">Adres</span><span class="text-deep-navy font-medium">Centrum Medyczne 7<br>ul. Powstańców Warszawy 7/1.5<br>26-110 Skarżysko-Kamienna</span></div>
        </div>
      </section>
      <section id="confirmation-required" class="mx-8 my-8 px-6 py-6 bg-blue-50 rounded-lg">
        <div class="flex items-start gap-4"><i class="fa-solid fa-circle-check text-lg text-teal-custom mt-1"></i>
          <div>
            <p class="text-navy font-medium mb-2">Potwierdzenie nowego terminu</p>
            <p class="text-deep-navy leading-relaxed mb-4">Nowy termin został automatycznie zarezerwowany. Jeśli nie jest on odpowiedni, prosimy o kontakt z rejestracją w celu ustalenia innego, dogodnego terminu wizyty.<br></p>
          </div>
        </div>
      </section>
      <section id="preparation-section" class="mx-8 my-8 px-6 py-6 bg-green-50 rounded-lg">
        <div class="flex items-start gap-4"><i class="fa-solid fa-list-check text-lg text-teal-custom mt-1"></i>
          <div>
            <p class="text-navy font-medium mb-2">Przygotowanie do wizyty</p>
            <p class="text-deep-navy leading-relaxed">Prosimy o zabranie ze sobą dokumentu tożsamości, w celu rejestracji. Dodatkową dokumentację medyczną można zabrać według uznania, jeśli pacjent chce przekazać ją lekarzowi.</p>
          </div>
        </div>
      </section>
      <section id="contact-section" class="px-8 py-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="flex items-center gap-3"><i class="fa-solid fa-phone text-teal-custom"></i>
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Telefon</div>
              <div class="font-medium text-deep-navy">+48 797 127 487</div>
            </div>
          </div>
          <div class="flex items-center gap-3"><i class="fa-solid fa-envelope text-teal-custom"></i>
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Email</div>
              <div class="font-medium text-deep-navy">kontakt@centrummedyczne7.pl</div>
            </div>
          </div>
        </div>
      </section>
      <section id="privacy-section" class="px-8 py-6 border-t border-gray-100">
        <p class="text-xs text-gray-500 leading-relaxed">
          Niniejsza wiadomość zawiera informacje medyczne podlegające ochronie prawnej. Jeśli nie jesteś właściwym odbiorcą, prosimy o niezwłoczne usunięcie wiadomości i poinformowanie nadawcy. Centrum Medyczne 7 dołożyło wszelkich starań, aby zapewnić bezpieczeństwo transmisji danych.
        </p>
      </section>
      <footer id="footer" class="px-8 py-8 bg-gray-50 text-center">
        <div class="space-y-2">
          <div class="text-sm text-gray-600 font-medium">© 2025 Centrum Medyczne 7</div>
          <div class="text-xs text-gray-400 mt-4">Ta wiadomość została wygenerowana automatycznie. Prosimy nie odpowiadać na ten e-mail.<br>Administratorem danych osobowych jest CM7 Sp. z o.o. Szczegółowe informacje na temat przetwarzania danych osobowych znajdują się w&nbsp;<a href="https://centrummedyczne7.pl/polityka-prywatnosci">Polityce Prywatności</a>.</div>
        </div>
      </footer>
    </div>
  </body>
</html>`;
};

const processConfirmationEmail = (data) => {
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';
  const { patientName, doctorName, date, time, mode } = data;
  const consultationType = mode === 'online' ? 'Online' : 'Stacjonarna';
  const teal = '#008C8C';
  const green = '#16a34a';
  
  // Full confirmation template - Font Awesome 6 icons as inline SVG (visible in all email clients)
  return `<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Potwierdzenie wizyty</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
    <style>${emailCSS}</style>
  </head>
  <body class="bg-white font-inter">
    <div id="email-container" class="max-w-680 mx-auto bg-white" style="max-width: 680px;">
      <header id="header" class="px-8 py-4 border-b border-gray-100">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <img src="${logoUrl}" alt="Centrum Medyczne 7 Logo" style="height: 50px; width: auto;" />
            <div class="text-lg font-semibold text-navy">Centrum Medyczne 7</div>
          </div>
          <div class="text-xs text-gray-500 uppercase tracking-wider">automatyczny system powiadomień</div>
        </div>
      </header>
      <section id="title-section" class="px-8 py-12 text-center">
        <div class="flex justify-center mb-6">${getIconImg('calendar-check', teal, 40)}</div>
        <h1 class="text-3xl font-bold text-navy mb-4">Potwierdzenie wizyty</h1>
        <p class="text-lg text-gray-600 leading-relaxed max-w-md mx-auto">
          Twoja wizyta została pomyślnie zarezerwowana. Poniżej znajdziesz wszystkie szczegóły dotyczące nadchodzącej konsultacji medycznej.
        </p>
      </section>
      <section id="confirmation-notice" class="mx-8 mb-8 px-6 py-5 bg-emerald-50 rounded-lg">
        <div class="flex items-start gap-4">${getIconImg('circle-check', green, 22)}
          <div>
            <p class="text-deep-navy font-medium mb-2">Wizyta potwierdzona</p>
            <p class="text-deep-navy leading-relaxed">Twoja wizyta została zarejestrowana w naszym systemie. <br>Prosimy o przybycie 10 minut przed wyznaczoną godziną w celu wypełnienia niezbędnych formalności.</p>
          </div>
        </div>
      </section>
      <section id="appointment-details" class="px-8 py-8">
        <div class="flex items-center gap-3 mb-8">${getIconImg('clipboard-list', teal, 22)}
          <h2 class="text-xl font-bold text-navy">Szczegóły wizyty</h2>
        </div>
        <div class="space-y-5">
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('user', teal, 20)}<span class="text-sm text-gray-500 uppercase tracking-wide w-32">Pacjent</span><span class="text-deep-navy font-medium">${patientName}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('user-doctor', teal, 20)}<span class="text-sm text-gray-500 uppercase tracking-wide w-32">Lekarz prowadzący</span><span class="text-deep-navy font-medium">${doctorName}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('calendar', teal, 20)}<span class="text-sm text-gray-500 uppercase tracking-wide w-32">Data</span><span class="text-deep-navy font-medium">${date}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('clock', teal, 20)}<span class="text-sm text-gray-500 uppercase tracking-wide w-32">Godzina</span><span class="text-deep-navy font-medium">${time}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('stethoscope', teal, 20)}<span class="text-sm text-gray-500 uppercase tracking-wide w-32">Forma konsultacji</span><span class="text-deep-navy font-medium">${consultationType}</span></div>
          <div class="flex items-start gap-4 py-4">${getIconImg('location-dot', teal, 20)}<span class="text-sm text-gray-500 uppercase tracking-wide w-32">Adres</span><span class="text-deep-navy font-medium">Centrum Medyczne 7<br>ul. Powstańców Warszawy 7/1.5<br>26-110 Skarżysko-Kamienna</span></div>
        </div>
      </section>
      <section id="preparation-section" class="mx-8 my-8 px-6 py-6 bg-blue-50 rounded-lg">
        <div class="flex items-start gap-4">${getIconImg('list-check', teal, 22)}
          <div>
            <p class="text-navy font-medium mb-2">Przygotowanie do wizyty</p>
            <p class="text-deep-navy leading-relaxed">Prosimy o zabranie ze sobą dokumentu tożsamości w celu rejestracji. Dodatkową dokumentację medyczną można zabrać według uznania, jeśli pacjent chce przekazać ją lekarzowi.</p>
          </div>
        </div>
      </section>
      <section id="cancellation-policy" class="mx-8 my-8 px-6 py-6 bg-yellow-50 rounded-lg">
        <div class="flex items-start gap-4">${getIconImg('info-circle', teal, 22)}
          <div>
            <p class="text-navy font-medium mb-2">Polityka odwoływania wizyt</p>
            <p class="text-deep-navy leading-relaxed">W przypadku konieczności odwołania wizyty prosimy o kontakt <br>z recepcją najpóźniej 24 godziny przed wyznaczonym terminem.&nbsp;<br>Odwołania dokonane w krótszym czasie nie będą rozpatrywane, zgodnie z regulaminem placówki.</p>
          </div>
        </div>
      </section>
      <section id="contact-section" class="px-8 py-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="flex items-center gap-3">${getIconImg('phone', teal, 20)}
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Telefon</div>
              <div class="font-medium text-deep-navy">+48 797 127 487</div>
            </div>
          </div>
          <div class="flex items-center gap-3">${getIconImg('envelope', teal, 20)}
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Email</div>
              <div class="font-medium text-deep-navy">kontakt@centrummedyczne7.pl</div>
            </div>
          </div>
        </div>
      </section>
      <section id="privacy-section" class="px-8 py-6 border-t border-gray-100">
        <p class="text-xs text-gray-500 leading-relaxed">
          Niniejsza wiadomość zawiera informacje medyczne podlegające ochronie prawnej. Jeśli nie jesteś właściwym odbiorcą, prosimy o niezwłoczne usunięcie wiadomości i poinformowanie nadawcy. Centrum Medyczne 7 dołożyło wszelkich starań, aby zapewnić bezpieczeństwo transmisji danych.
        </p>
      </section>
      <footer id="footer" class="px-8 py-8 bg-gray-50 text-center">
        <div class="space-y-2">
          <div class="text-sm text-gray-600 font-medium">© 2025 Centrum Medyczne 7</div>
          <div class="text-xs text-gray-400 mt-4">Ta wiadomość została wygenerowana automatycznie. Prosimy nie odpowiadać na ten e-mail.<br>Administratorem danych osobowych jest CM7 Sp. z o.o. Szczegółowe informacje na temat przetwarzania danych osobowych znajdują się w <a href="https://centrummedyczne7.pl/polityka-prywatnosci">Polityce Prywatności</a>.</div>
        </div>
      </footer>
    </div>
  </body>
</html>`;
};

// Sample data for email templates
const getSampleData = () => ({
  // Welcome email data
  welcomeData: {
    name: "Jan Kowalski",
    email: "jan.kowalski@example.com",
    password: "temp123456"
  },
  
  // Appointment confirmation data
  appointmentData: {
    patientName: "Jan Kowalski",
    doctorName: "Dr. Anna Nowak",
    date: "15.01.2025",
    time: "10:00 - 10:30",
    department: "Kardiologia",
    meetingLink: "https://meet.google.com/abc-defg-hij",
    notes: "Kontrolna wizyta",
    mode: "online",
    isNewUser: false,
    temporaryPassword: null
  },
  
  // Reschedule email data
  rescheduleData: {
    patientName: "Jan Kowalski",
    doctorName: "Dr. Anna Nowak",
    oldDate: "10.01.2025",
    oldTime: "10:00 - 10:30",
    newDate: "15.01.2025",
    newTime: "14:00 - 14:30",
    department: "Kardiologia",
    mode: "stacjonarna"
  },
  
  // Password reset data
  passwordResetData: {
    otp: "123456",
    userRole: "Lekarz"
  },
  
  // Cancellation email data
  cancellationData: {
    patientName: "Jan Kowalski",
    doctorName: "Dr. Anna Nowak",
    date: "15.01.2025",
    time: "10:00 - 10:30",
    mode: "stacjonarna"
  }
});

// Welcome Email Template (English)
const createWelcomeEmailEnglish = (userData) => {
  const { name, email, password } = userData;
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="${logoUrl}" alt="Centrum Medical Center Logo" style="width: 220px; max-width: 100%; height: auto; margin-bottom: 20px;" />
        <h2 style="color: #3f51b5; margin-top: 10px;">Welcome to Centrum Medical Center</h2>
        <p style="color: #666;">Your account has been created successfully</p>
      </div>
      
      <div style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #3f51b5;">Your Account Information</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Temporary Password:</strong> ${password}</p>
      </div>
      
      <div style="margin-bottom: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #1976d2;">Important Information</h3>
        <p>For security reasons, we recommend changing your password after your first login.</p>
        <p>You can log in to your account at <a href="https://centrum-pl.netlify.app/user" style="color: #1976d2; text-decoration: none;">https://centrum-pl.netlify.app/user</a></p>
      </div>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 14px;">
        <p>Thank you for choosing Centrum Medical Center.</p>
        <p>If you have any questions, please contact our support team.</p>
        <p>© ${new Date().getFullYear()} Centrum Medyczne - Wszelkie prawa zastrzeżone</p>
      </div>
    </div>
  `;
};

// Welcome Email Template (Polish)
const createWelcomeEmailPolish = (userData) => {
  const { name, email, password } = userData;
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="${logoUrl}" alt="Centrum Medyczne Logo" style="width: 220px; max-width: 100%; height: auto; margin-bottom: 20px;" />
        <h2 style="color: #3f51b5; margin-top: 10px;">Witamy w Centrum Medycznym</h2>
        <p style="color: #666;">Twoje konto zostało pomyślnie utworzone</p>
      </div>
      
      <div style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #3f51b5;">Informacje o Twoim koncie</h3>
        <p><strong>Imię i nazwisko:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Tymczasowe hasło:</strong> ${password}</p>
      </div>
      
      <div style="margin-bottom: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #1976d2;">Ważne informacje</h3>
        <p>Ze względów bezpieczeństwa zalecamy zmianę hasła po pierwszym logowaniu.</p>
        <p>Możesz zalogować się na swoje konto na <a href="https://centrum-pl.netlify.app/user" style="color: #1976d2; text-decoration: none;">https://centrum-pl.netlify.app/user</a></p>
      </div>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 14px;">
        <p>Dziękujemy za wybór Centrum Medycznego.</p>
        <p>W razie pytań prosimy o kontakt z naszym zespołem wsparcia.</p>
        <p>© ${new Date().getFullYear()} Centrum Medyczne - Wszelkie prawa zastrzeżone</p>
      </div>
    </div>
  `;
};

// Appointment Confirmation Email Template
const createAppointmentEmailHtml = (appointmentDetails) => {
  const {
    patientName,
    doctorName,
    date,
    time,
    department,
    meetingLink,
    notes,
    mode,
    isNewUser,
    temporaryPassword,
  } = appointmentDetails;

  // Format doctor name to match template format (lek. FirstName LastName)
  const formattedDoctorName = doctorName.startsWith('Dr.') 
    ? doctorName.replace('Dr.', 'lek.')
    : doctorName.startsWith('lek.') 
      ? doctorName 
      : `lek. ${doctorName}`;

  return processConfirmationEmail({
    patientName,
    doctorName: formattedDoctorName,
    date,
    time,
    mode: mode || 'stacjonarna'
  });
};

// Reschedule Email Template
const createRescheduleEmailHtml = (rescheduleDetails) => {
  const {
    patientName,
    doctorName,
    oldDate,
    oldTime,
    newDate,
    newTime,
    department,
    mode,
  } = rescheduleDetails;

  // Format doctor name to match template format (lek. FirstName LastName)
  const formattedDoctorName = doctorName.startsWith('Dr.') 
    ? doctorName.replace('Dr.', 'lek.')
    : doctorName.startsWith('lek.') 
      ? doctorName 
      : `lek. ${doctorName}`;

  return processRescheduleEmail({
    patientName,
    doctorName: formattedDoctorName,
    oldDate,
    oldTime,
    newDate,
    newTime,
    mode: mode || 'stacjonarna'
  });
};

// Appointment Cancellation Email Template
const createCancellationEmailHtml = (cancellationDetails) => {
  const {
    patientName,
    doctorName,
    date,
    time,
    mode,
  } = cancellationDetails;

  // Format doctor name to match template format (lek. FirstName LastName)
  const formattedDoctorName = doctorName.startsWith('Dr.') 
    ? doctorName.replace('Dr.', 'lek.')
    : doctorName.startsWith('lek.') 
      ? doctorName 
      : `lek. ${doctorName}`;

  return processCancellationEmail({
    patientName,
    doctorName: formattedDoctorName,
    date,
    time,
    mode: mode || 'stacjonarna'
  });
};

// Password Reset Email Template
const createPasswordResetEmailHtml = (otp, userRole) => {
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';
  
  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Hasła - Centrum Medyczne</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                background-color: #000000;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 8px 8px 0 0;
            }
            .logo-container {
                display: inline-block;
                background-color: rgba(255, 255, 255, 0.95);
                border-radius: 12px;
                padding: 12px;
                margin-bottom: 15px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .logo {
                max-width: 150px;
                height: auto;
                margin-bottom: 0;
                background-color: transparent !important;
                border-radius: 8px;
                padding: 0;
                filter: brightness(1) contrast(1);
                display: block;
            }
            .content {
                background-color: #f9f9f9;
                padding: 30px;
                border-radius: 0 0 8px 8px;
                border: 1px solid #ddd;
            }
            .otp-code {
                background-color: #20B2AA;
                color: white;
                font-size: 32px;
                font-weight: bold;
                text-align: center;
                padding: 20px;
                margin: 20px 0;
                border-radius: 8px;
                letter-spacing: 5px;
            }
            .warning {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                font-size: 12px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo-container">
                <img src="${logoUrl}" alt="CM7MED Logo" class="logo" />
            </div>
            <h1>Centrum Medyczne</h1>
            <h2>Reset Hasła</h2>
        </div>
        
        <div class="content">
            <p>Witaj ${userRole},</p>
            
            <p>Otrzymałeś ten email, ponieważ zostało zgłoszone żądanie resetu hasła dla Twojego konta.</p>
            
            <p><strong>Twój kod weryfikacyjny to:</strong></p>
            
            <div class="otp-code">${otp}</div>
            
            <div class="warning">
                <strong>⚠️ Ważne informacje:</strong>
                <ul>
                    <li>Kod jest ważny przez <strong>10 minut</strong></li>
                    <li>Nie udostępniaj tego kodu nikomu</li>
                    <li>Jeśli nie zgłaszałeś resetu hasła, zignoruj ten email</li>
                    <li>Kod może być użyty tylko raz</li>
                </ul>
            </div>
            
            <p>Jeśli masz problemy z dostępem do konta, skontaktuj się z administratorem systemu.</p>
            
            <p>Z poważaniem,<br>
            <strong>Zespół Centrum Medycznego</strong></p>
        </div>
        
        <div class="footer">
            <p>Ten email został wygenerowany automatycznie. Prosimy nie odpowiadać na tę wiadomość.</p>
        </div>
    </body>
    </html>
  `;
};

/**
 * Send all email templates to preview email
 * @route POST /api/email-preview/send-all
 * @access Private (admin only)
 */
exports.sendAllEmailTemplates = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required"
      });
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    const sampleData = getSampleData();
    const results = [];

    // 1. Welcome Email (English)
    try {
      await sendEmail({
        to: email,
        subject: "[PREVIEW] Welcome to Centrum Medical Center (English)",
        html: createWelcomeEmailEnglish(sampleData.welcomeData),
        text: `Welcome to Centrum Medical Center!\n\nYour account has been created successfully.\n\nName: ${sampleData.welcomeData.name}\nEmail: ${sampleData.welcomeData.email}\nTemporary Password: ${sampleData.welcomeData.password}\n\nThank you for choosing Centrum Medical Center.`
      });
      results.push({ template: "Welcome Email (English)", status: "sent" });
    } catch (error) {
      results.push({ template: "Welcome Email (English)", status: "failed", error: error.message });
    }

    // 2. Welcome Email (Polish)
    try {
      await sendEmail({
        to: email,
        subject: "[PREVIEW] Witamy w Centrum Medycznym (Polish)",
        html: createWelcomeEmailPolish(sampleData.welcomeData),
        text: `Witamy w Centrum Medycznym!\n\nTwoje konto zostało pomyślnie utworzone.\n\nImię i nazwisko: ${sampleData.welcomeData.name}\nEmail: ${sampleData.welcomeData.email}\nTymczasowe hasło: ${sampleData.welcomeData.password}\n\nDziękujemy za wybór Centrum Medycznego.`
      });
      results.push({ template: "Welcome Email (Polish)", status: "sent" });
    } catch (error) {
      results.push({ template: "Welcome Email (Polish)", status: "failed", error: error.message });
    }

    // 3. Appointment Confirmation Email
    try {
      await sendEmail({
        to: email,
        subject: "[PREVIEW] Potwierdzenie Wizyty (Appointment Confirmation)",
        html: createAppointmentEmailHtml(sampleData.appointmentData),
        text: `Potwierdzenie Wizyty\n\nTwoja wizyta została pomyślnie umówiona.\n\nPacjent: ${sampleData.appointmentData.patientName}\nLekarz: ${sampleData.appointmentData.doctorName}\nData: ${sampleData.appointmentData.date}\nGodzina: ${sampleData.appointmentData.time}\nForma konsultacji: ${sampleData.appointmentData.mode}`
      });
      results.push({ template: "Appointment Confirmation", status: "sent" });
    } catch (error) {
      results.push({ template: "Appointment Confirmation", status: "failed", error: error.message });
    }

    // 4. Reschedule Email
    try {
      await sendEmail({
        to: email,
        subject: "[PREVIEW] Zmiana Terminu Wizyty (Reschedule)",
        html: createRescheduleEmailHtml(sampleData.rescheduleData),
        text: `Zmiana Terminu Wizyty\n\nTwoja wizyta została przełożona.\n\nStary termin: ${sampleData.rescheduleData.oldDate} ${sampleData.rescheduleData.oldTime}\nNowy termin: ${sampleData.rescheduleData.newDate} ${sampleData.rescheduleData.newTime}`
      });
      results.push({ template: "Reschedule Email", status: "sent" });
    } catch (error) {
      results.push({ template: "Reschedule Email", status: "failed", error: error.message });
    }

    // 5. Password Reset Email
    try {
      await sendEmail({
        to: email,
        subject: "[PREVIEW] Reset Hasła (Password Reset)",
        html: createPasswordResetEmailHtml(sampleData.passwordResetData.otp, sampleData.passwordResetData.userRole),
        text: `Reset Hasła\n\nTwój kod weryfikacyjny: ${sampleData.passwordResetData.otp}\n\nKod jest ważny przez 10 minut.`
      });
      results.push({ template: "Password Reset", status: "sent" });
    } catch (error) {
      results.push({ template: "Password Reset", status: "failed", error: error.message });
    }

    // 6. Appointment Cancellation Email
    try {
      await sendEmail({
        to: email,
        subject: "[PREVIEW] Odwołanie wizyty – Centrum Medyczne 7 (Cancellation)",
        html: createCancellationEmailHtml(sampleData.cancellationData),
        text: `Odwołanie Wizyty\n\nWizyta została odwołana z przyczyn organizacyjnych lub na prośbę pacjenta.\n\nSzczegóły Odwołanej Wizyty:\nPacjent: ${sampleData.cancellationData.patientName}\nLekarz prowadzący: ${sampleData.cancellationData.doctorName}\nData: ${sampleData.cancellationData.date}\nGodzina: ${sampleData.cancellationData.time}\nForma konsultacji: ${sampleData.cancellationData.mode === "online" ? "Online" : "Stacjonarna"}\nAdres: ul. Powstańców Warszawy 7/1.5, 26-110 Skarżysko-Kamienna\n\nW przypadku gdy wizyta nie została odwołana z Państwa inicjatywy ani nie przekazano wcześniej takiej informacji telefonicznie, prosimy o niezwłoczny kontakt z rejestracją w celu potwierdzenia statusu wizyty.\n\nInformacja o odwołaniu mogła zostać wygenerowana automatycznie w wyniku błędu systemowego lub nieprawidłowej synchronizacji danych.\n\nKlauzula poufności:\nNiniejsza wiadomość oraz wszelkie załączone informacje są przeznaczone wyłącznie dla adresata i mogą zawierać dane osobowe lub informacje medyczne objęte tajemnicą zawodową.\nJeśli wiadomość trafiła do Państwa omyłkowo, prosimy o niezwłoczne usunięcie jej treści i poinformowanie nadawcy.\n\n© 2025 Centrum Medyczne 7 – Wszelkie prawa zastrzeżone`
      });
      results.push({ template: "Appointment Cancellation", status: "sent" });
    } catch (error) {
      results.push({ template: "Appointment Cancellation", status: "failed", error: error.message });
    }

    res.status(200).json({
      success: true,
      message: "Email templates sent for preview",
      data: {
        previewEmail: email,
        templatesSent: results.length,
        results: results
      }
    });

  } catch (error) {
    console.error("Error sending email previews:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email previews",
      error: error.message
    });
  }
};

/**
 * Get list of all available email templates
 * @route GET /api/email-preview/templates
 * @access Private (admin only)
 */
exports.getEmailTemplatesList = async (req, res) => {
  try {
    const templates = [
      {
        id: "welcome-english",
        name: "Welcome Email (English)",
        description: "Sent to new users when account is created",
        subject: "Welcome to Centrum Medical Center",
        usage: "User registration, account creation"
      },
      {
        id: "welcome-polish",
        name: "Welcome Email (Polish)",
        description: "Sent to new users when account is created (Polish version)",
        subject: "Witamy w Centrum Medycznym",
        usage: "User registration, account creation"
      },
      {
        id: "appointment-confirmation",
        name: "Appointment Confirmation",
        description: "Sent when appointment is successfully booked",
        subject: "Potwierdzenie Wizyty",
        usage: "Appointment booking confirmation"
      },
      {
        id: "appointment-reschedule",
        name: "Appointment Reschedule",
        description: "Sent when appointment is rescheduled",
        subject: "Zmiana Terminu Wizyty",
        usage: "Appointment rescheduling"
      },
      {
        id: "password-reset",
        name: "Password Reset",
        description: "Sent when user requests password reset",
        subject: "Reset Hasła",
        usage: "Password reset with OTP"
      },
      {
        id: "appointment-cancellation",
        name: "Appointment Cancellation",
        description: "Sent when appointment is cancelled",
        subject: "Odwołanie wizyty – Centrum Medyczne 7",
        usage: "Appointment cancellation notification"
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        totalTemplates: templates.length,
        templates: templates
      }
    });

  } catch (error) {
    console.error("Error getting email templates list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get email templates list",
      error: error.message
    });
  }
};

/**
 * Send all appointment email templates (confirmation, cancellation, reschedule) to fixed email
 * @route POST /api/email-preview/send-appointment-emails
 * @access Private (admin only)
 */
exports.sendAppointmentEmailsToFixedAddress = async (req, res) => {
  try {
    const fixedEmail = "harshvchawla997@gmail.com";
    
    // Mock data for appointment emails
    const mockData = {
      confirmation: {
        patientName: "Jan Kowalski",
        doctorName: "lek. Anna Nowak",
        date: "25.01.2025",
        time: "14:00 - 14:30",
        mode: "stacjonarna"
      },
      cancellation: {
        patientName: "Maria Wiśniewska",
        doctorName: "lek. Piotr Kowalczyk",
        date: "20.01.2025",
        time: "10:00 - 10:30",
        mode: "online"
      },
      reschedule: {
        patientName: "Tomasz Zieliński",
        doctorName: "lek. Katarzyna Nowak",
        oldDate: "18.01.2025",
        oldTime: "09:00",
        newDate: "22.01.2025",
        newTime: "11:30",
        mode: "stacjonarna"
      }
    };

    const results = [];

    // 1. Appointment Confirmation Email
    try {
      await sendEmail({
        to: fixedEmail,
        subject: "[TEST] Potwierdzenie Wizyty - Centrum Medyczne 7",
        html: createAppointmentEmailHtml(mockData.confirmation),
        text: `Potwierdzenie Wizyty\n\nTwoja wizyta została pomyślnie umówiona.\n\nPacjent: ${mockData.confirmation.patientName}\nLekarz: ${mockData.confirmation.doctorName}\nData: ${mockData.confirmation.date}\nGodzina: ${mockData.confirmation.time}\nForma konsultacji: ${mockData.confirmation.mode}`
      });
      results.push({ template: "Appointment Confirmation", status: "sent", email: fixedEmail });
      console.log(`✓ Confirmation email sent to ${fixedEmail}`);
    } catch (error) {
      results.push({ template: "Appointment Confirmation", status: "failed", error: error.message });
      console.error("✗ Failed to send confirmation email:", error);
    }

    // 2. Appointment Cancellation Email
    try {
      await sendEmail({
        to: fixedEmail,
        subject: "[TEST] Odwołanie wizyty – Centrum Medyczne 7",
        html: createCancellationEmailHtml(mockData.cancellation),
        text: `Odwołanie Wizyty\n\nWizyta została odwołana z przyczyn organizacyjnych lub na prośbę pacjenta.\n\nSzczegóły Odwołanej Wizyty:\nPacjent: ${mockData.cancellation.patientName}\nLekarz prowadzący: ${mockData.cancellation.doctorName}\nData: ${mockData.cancellation.date}\nGodzina: ${mockData.cancellation.time}\nForma konsultacji: ${mockData.cancellation.mode === "online" ? "Online" : "Stacjonarna"}`
      });
      results.push({ template: "Appointment Cancellation", status: "sent", email: fixedEmail });
      console.log(`✓ Cancellation email sent to ${fixedEmail}`);
    } catch (error) {
      results.push({ template: "Appointment Cancellation", status: "failed", error: error.message });
      console.error("✗ Failed to send cancellation email:", error);
    }

    // 3. Appointment Reschedule Email
    try {
      await sendEmail({
        to: fixedEmail,
        subject: "[TEST] Zmiana Terminu Wizyty – Centrum Medyczne 7",
        html: createRescheduleEmailHtml(mockData.reschedule),
        text: `Zmiana Terminu Wizyty\n\nTwoja wizyta została przełożona.\n\nStary termin: ${mockData.reschedule.oldDate} ${mockData.reschedule.oldTime}\nNowy termin: ${mockData.reschedule.newDate} ${mockData.reschedule.newTime}`
      });
      results.push({ template: "Appointment Reschedule", status: "sent", email: fixedEmail });
      console.log(`✓ Reschedule email sent to ${fixedEmail}`);
    } catch (error) {
      results.push({ template: "Appointment Reschedule", status: "failed", error: error.message });
      console.error("✗ Failed to send reschedule email:", error);
    }

    const successCount = results.filter(r => r.status === "sent").length;
    const failCount = results.filter(r => r.status === "failed").length;

    res.status(200).json({
      success: true,
      message: `Appointment emails sent to ${fixedEmail}`,
      data: {
        targetEmail: fixedEmail,
        totalTemplates: results.length,
        successful: successCount,
        failed: failCount,
        results: results
      }
    });

  } catch (error) {
    console.error("Error sending appointment email previews:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send appointment email previews",
      error: error.message
    });
  }
};

/**
 * Send only the "Potwierdzenie wizyty" (Visit confirmation) email with hardcoded test data to a given email.
 * Use this to test the confirmation template.
 * @route POST /api/email-preview/send-confirmation
 * @access Public (for testing)
 */
exports.sendConfirmationEmailTest = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required. Provide it in the request body: { \"email\": \"your@email.com\" }"
      });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // Hardcoded test data for the confirmation template
    const testData = {
      patientName: "Anna Kowalska",
      doctorName: "lek. Marek Nowak",
      date: "15.02.2025",
      time: "10:30 - 11:00",
      mode: "stacjonarna"
    };

    const html = createAppointmentEmailHtml(testData);
    const subject = "[TEST] Potwierdzenie wizyty – Centrum Medyczne 7";

    await sendEmail({
      to: email,
      subject,
      html,
      text: `Potwierdzenie Wizyty (test)\n\nPacjent: ${testData.patientName}\nLekarz: ${testData.doctorName}\nData: ${testData.date}\nGodzina: ${testData.time}\nForma: ${testData.mode === "online" ? "Online" : "Stacjonarna"}`
    });

    return res.status(200).json({
      success: true,
      message: "Confirmation email sent successfully",
      data: {
        to: email,
        subject,
        testData
      }
    });
  } catch (error) {
    console.error("Error sending confirmation email test:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send confirmation email",
      error: error.message
    });
  }
};


