const PatientBill = require("../models/patientBill");

/**
 * Generates the next invoice ID in format CM7/MM/YYYY/NNN
 * @returns {Promise<string>} The next invoice ID
 */
async function generateNextInvoiceId() {
  try {
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0'); // MM format
    const currentYear = now.getFullYear(); // YYYY format
    
    // Create the prefix for current month/year
    const monthYearPrefix = `CM7/${currentMonth}/${currentYear}/`;
    
    // Find the latest invoice for the current month and year
    // Using regex to match invoices with the current month/year prefix
    const latestInvoice = await PatientBill.findOne({
      invoice_id: { 
        $regex: `^${monthYearPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` 
      },
      isDeleted: false
    })
    .sort({ invoice_id: -1 }) // Sort by invoice_id descending to get the latest
    .select('invoice_id')
    .lean();
    
    let nextSequentialNumber = 1;
    
    if (latestInvoice && latestInvoice.invoice_id) {
      // Extract the sequential number from the latest invoice
      const parts = latestInvoice.invoice_id.split('/');
      if (parts.length === 4) {
        const lastSequentialNumber = parseInt(parts[3], 10);
        if (!isNaN(lastSequentialNumber)) {
          nextSequentialNumber = lastSequentialNumber + 1;
        }
      }
    }
    
    // Format the sequential number as 3 digits (001, 002, etc.)
    const formattedSequentialNumber = String(nextSequentialNumber).padStart(3, '0');
    
    // Combine all parts to create the invoice ID
    const invoiceId = `${monthYearPrefix}${formattedSequentialNumber}`;
    
    return invoiceId;
    
  } catch (error) {
    console.error('Error generating invoice ID:', error);
    throw new Error('Failed to generate invoice ID');
  }
}

/**
 * Alternative version with explicit month/year parameters
 * Useful for testing or generating IDs for specific dates
 * @param {number} month - Month (1-12)
 * @param {number} year - Full year (e.g., 2025)
 * @returns {Promise<string>} The next invoice ID for specified month/year
 */
async function generateInvoiceIdForDate(month, year) {
  try {
    const formattedMonth = String(month).padStart(2, '0');
    const monthYearPrefix = `CM7/${formattedMonth}/${year}/`;
    
    const latestInvoice = await PatientBill.findOne({
      invoice_id: { 
        $regex: `^${monthYearPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` 
      },
      isDeleted: false
    })
    .sort({ invoice_id: -1 })
    .select('invoice_id')
    .lean();
    
    let nextSequentialNumber = 1;
    
    if (latestInvoice && latestInvoice.invoice_id) {
      const parts = latestInvoice.invoice_id.split('/');
      if (parts.length === 4) {
        const lastSequentialNumber = parseInt(parts[3], 10);
        if (!isNaN(lastSequentialNumber)) {
          nextSequentialNumber = lastSequentialNumber + 1;
        }
      }
    }
    
    const formattedSequentialNumber = String(nextSequentialNumber).padStart(3, '0');
    const invoiceId = `${monthYearPrefix}${formattedSequentialNumber}`;
    
    return invoiceId;
    
  } catch (error) {
    console.error('Error generating invoice ID for specific date:', error);
    throw new Error('Failed to generate invoice ID');
  }
}

module.exports = {
  generateNextInvoiceId,
  generateInvoiceIdForDate
};

// Usage examples:
/*
// Generate next invoice ID for current month/year
const nextId = await generateNextInvoiceId();
console.log(nextId); // e.g., "CM7/05/2025/001"

// Generate invoice ID for specific month/year
const specificId = await generateInvoiceIdForDate(6, 2025);
console.log(specificId); // e.g., "CM7/06/2025/001"
*/