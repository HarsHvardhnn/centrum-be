const fs = require('fs');
const path = require('path');

/**
 * Email Template Processor
 * Converts HTML templates with Tailwind classes to email-compatible HTML with inline CSS
 */

// Mapping of Tailwind classes to inline CSS styles
const tailwindToInline = {
  // Background colors
  'bg-white': 'background-color: #ffffff;',
  'bg-gray-50': 'background-color: #f9fafb;',
  'bg-gray-100': 'background-color: #f3f4f6;',
  'bg-emerald-50': 'background-color: #ecfdf5;',
  'bg-blue-50': 'background-color: #eff6ff;',
  'bg-yellow-50': 'background-color: #fefce8;',
  'bg-red-50': 'background-color: #fef2f2;',
  'bg-orange-50': 'background-color: #fff7ed;',
  'bg-green-50': 'background-color: #f0fdf4;',
  'bg-teal-50': 'background-color: #f0fdfa;',
  'bg-teal-custom': 'background-color: #008C8C;',
  
  // Text colors
  'text-white': 'color: #ffffff;',
  'text-gray-400': 'color: #9ca3af;',
  'text-gray-500': 'color: #6b7280;',
  'text-gray-600': 'color: #4b5563;',
  'text-gray-700': 'color: #374151;',
  'text-navy': 'color: #1e3a8a;',
  'text-deep-navy': 'color: #0f1419;',
  'text-teal-custom': 'color: #008C8C;',
  'text-success-green': 'color: #16a34a;',
  'text-warning-red': 'color: #dc2626;',
  'text-warning-orange': 'color: #f97316;',
  
  // Font weights
  'font-medium': 'font-weight: 500;',
  'font-semibold': 'font-weight: 600;',
  'font-bold': 'font-weight: 700;',
  'font-inter': 'font-family: \'Inter\', Arial, sans-serif;',
  
  // Font sizes
  'text-xs': 'font-size: 0.75rem; line-height: 1rem;',
  'text-sm': 'font-size: 0.875rem; line-height: 1.25rem;',
  'text-lg': 'font-size: 1.125rem; line-height: 1.75rem;',
  'text-xl': 'font-size: 1.25rem; line-height: 1.75rem;',
  'text-3xl': 'font-size: 1.875rem; line-height: 2.25rem;',
  'text-4xl': 'font-size: 2.25rem; line-height: 2.5rem;',
  
  // Text utilities
  'uppercase': 'text-transform: uppercase;',
  'tracking-wide': 'letter-spacing: 0.025em;',
  'tracking-wider': 'letter-spacing: 0.05em;',
  'leading-relaxed': 'line-height: 1.625;',
  'line-through': 'text-decoration: line-through;',
  'text-center': 'text-align: center;',
  
  // Padding
  'px-6': 'padding-left: 1.5rem; padding-right: 1.5rem;',
  'px-8': 'padding-left: 2rem; padding-right: 2rem;',
  'py-3': 'padding-top: 0.75rem; padding-bottom: 0.75rem;',
  'py-4': 'padding-top: 1rem; padding-bottom: 1rem;',
  'py-5': 'padding-top: 1.25rem; padding-bottom: 1.25rem;',
  'py-6': 'padding-top: 1.5rem; padding-bottom: 1.5rem;',
  'py-8': 'padding-top: 2rem; padding-bottom: 2rem;',
  'py-12': 'padding-top: 3rem; padding-bottom: 3rem;',
  
  // Margin
  'mx-8': 'margin-left: 2rem; margin-right: 2rem;',
  'my-8': 'margin-top: 2rem; margin-bottom: 2rem;',
  'mb-2': 'margin-bottom: 0.5rem;',
  'mb-4': 'margin-bottom: 1rem;',
  'mb-6': 'margin-bottom: 1.5rem;',
  'mb-8': 'margin-bottom: 2rem;',
  'mt-1': 'margin-top: 0.25rem;',
  'mt-4': 'margin-top: 1rem;',
  
  // Display
  'flex': 'display: flex;',
  'grid': 'display: grid;',
  'items-center': 'align-items: center;',
  'items-start': 'align-items: flex-start;',
  'justify-between': 'justify-content: space-between;',
  'justify-center': 'justify-content: center;',
  
  // Gap
  'gap-3': 'gap: 0.75rem;',
  'gap-4': 'gap: 1rem;',
  'gap-6': 'gap: 1.5rem;',
  
  // Borders
  'border-b': 'border-bottom-width: 1px; border-bottom-style: solid;',
  'border-t': 'border-top-width: 1px; border-top-style: solid;',
  'border-gray-100': 'border-color: #f3f4f6;',
  'border-teal-100': 'border-color: #ccfbf1;',
  
  // Border radius
  'rounded-lg': 'border-radius: 0.5rem;',
  'rounded-full': 'border-radius: 9999px;',
  
  // Width/Height
  'w-5': 'width: 1.25rem;',
  'w-8': 'width: 2rem;',
  'w-32': 'width: 8rem;',
  'h-8': 'height: 2rem;',
  
  // Max width
  'max-w-[680px]': 'max-width: 680px;',
  'max-w-md': 'max-width: 28rem;',
  'mx-auto': 'margin-left: auto; margin-right: auto;',
};

// Font Awesome icon to Unicode/HTML entity mapping
const iconMap = {
  'fa-plus': '&#43;',
  'fa-calendar-xmark': '&#128197;',
  'fa-calendar-check': '&#10004;',
  'fa-calendar-minus': '&#128197;',
  'fa-calendar-plus': '&#128197;',
  'fa-calendar': '&#128197;',
  'fa-user': '&#128100;',
  'fa-user-doctor': '&#9877;',
  'fa-clock': '&#128336;',
  'fa-stethoscope': '&#129498;',
  'fa-location-dot': '&#128205;',
  'fa-phone': '&#128222;',
  'fa-envelope': '&#9993;',
  'fa-triangle-exclamation': '&#9888;',
  'fa-circle-check': '&#10004;',
  'fa-circle-exclamation': '&#9888;',
  'fa-list-check': '&#9989;',
  'fa-info-circle': '&#8505;',
  'fa-clipboard-list': '&#128203;',
};

/**
 * Convert Tailwind classes to inline styles
 */
function convertClassesToInline(html) {
  // Extract all class attributes and convert them
  return html.replace(/class="([^"]*)"/g, (match, classes) => {
    const classList = classes.split(/\s+/).filter(c => c);
    const inlineStyles = [];
    
    classList.forEach(className => {
      if (tailwindToInline[className]) {
        inlineStyles.push(tailwindToInline[className]);
      }
    });
    
    if (inlineStyles.length > 0) {
      return `style="${inlineStyles.join(' ')}"`;
    }
    return match;
  });
}

/**
 * Replace Font Awesome icons with Unicode/HTML entities
 */
function replaceIcons(html) {
  // Replace <i class="fa-solid fa-*"></i> with Unicode/HTML entities
  return html.replace(/<i\s+class="[^"]*fa-solid\s+([^"]+)"[^>]*><\/i>/g, (match, iconClass) => {
    const iconName = iconClass.trim();
    if (iconMap[iconName]) {
      return `<span style="font-size: inherit;">${iconMap[iconName]}</span>`;
    }
    return match;
  });
}

/**
 * Process email template to make it email-client compatible
 */
function processEmailTemplate(html) {
  let processed = html;
  
  // Remove Tailwind CDN script
  processed = processed.replace(/<script[^>]*src="https:\/\/cdn\.tailwindcss\.com[^"]*"[^>]*><\/script>/gi, '');
  
  // Remove Tailwind config script
  processed = processed.replace(/<script[^>]*>[\s\S]*?tailwind\.config[\s\S]*?<\/script>/gi, '');
  
  // Remove Font Awesome CDN script
  processed = processed.replace(/<script[^>]*src="https:\/\/cdnjs\.cloudflare\.com[^"]*font-awesome[^"]*"[^>]*><\/script>/gi, '');
  
  // Remove Font Awesome config script
  processed = processed.replace(/<script[^>]*>[\s\S]*?FontAwesomeConfig[\s\S]*?<\/script>/gi, '');
  
  // Remove Google Fonts link (we'll use web-safe fonts as fallback)
  processed = processed.replace(/<link[^>]*href="https:\/\/fonts\.googleapis\.com[^"]*"[^>]*>/gi, '');
  
  // Add email-compatible CSS in style tag
  const emailCSS = `
    <style type="text/css">
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      body {
        margin: 0;
        padding: 0;
        font-family: 'Inter', Arial, Helvetica, sans-serif;
        background-color: #ffffff;
        color: #0f1419;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      
      /* Fallback for email clients that don't support Inter */
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      
      /* Utility classes for email clients that support style tags */
      .bg-white { background-color: #ffffff !important; }
      .bg-gray-50 { background-color: #f9fafb !important; }
      .bg-gray-100 { background-color: #f3f4f6 !important; }
      .bg-emerald-50 { background-color: #ecfdf5 !important; }
      .bg-blue-50 { background-color: #eff6ff !important; }
      .bg-yellow-50 { background-color: #fefce8 !important; }
      .bg-red-50 { background-color: #fef2f2 !important; }
      .bg-orange-50 { background-color: #fff7ed !important; }
      .bg-green-50 { background-color: #f0fdf4 !important; }
      .bg-teal-50 { background-color: #f0fdfa !important; }
      
      @media only screen and (max-width: 600px) {
        .max-w-680 {
          width: 100% !important;
          max-width: 100% !important;
        }
        .px-8 {
          padding-left: 1rem !important;
          padding-right: 1rem !important;
        }
        .mx-8 {
          margin-left: 1rem !important;
          margin-right: 1rem !important;
        }
      }
    </style>
  `;
  
  // Insert CSS after opening head tag
  processed = processed.replace(/<head[^>]*>/i, `$&${emailCSS}`);
  
  // Convert Tailwind classes to inline styles
  processed = convertClassesToInline(processed);
  
  // Replace Font Awesome icons
  processed = replaceIcons(processed);
  
  // Ensure all elements have inline styles as fallback
  // This is a basic implementation - for production, consider using a library like juice
  
  return processed;
}

/**
 * Load and process email template from file
 */
function loadAndProcessTemplate(templatePath, replacements = {}) {
  try {
    let html = fs.readFileSync(templatePath, 'utf8');
    
    // Replace placeholders
    Object.keys(replacements).forEach(key => {
      const value = replacements[key] || '';
      const placeholderRegex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(placeholderRegex, value);
    });
    
    // Process for email compatibility
    html = processEmailTemplate(html);
    
    return html;
  } catch (error) {
    console.error(`Error loading email template ${templatePath}:`, error);
    throw error;
  }
}

module.exports = {
  processEmailTemplate,
  loadAndProcessTemplate,
  convertClassesToInline,
  replaceIcons
};



