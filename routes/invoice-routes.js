const express = require('express');
const router = express.Router();
const { handleGenerateNextInvoiceId, handleGenerateInvoiceIdForDate } = require('../controllers/invoiceName');

/**
 * @route   GET /api/invoice/generate-next
 * @desc    Generate next invoice ID for current month/year
 * @access  Private
 */
router.get('/generate-next', handleGenerateNextInvoiceId);

/**
 * @route   POST /api/invoice/generate-for-date
 * @desc    Generate invoice ID for specific month/year
 * @access  Private
 * @body    {month: number, year: number}
 */
router.post('/generate-for-date', handleGenerateInvoiceIdForDate);

module.exports = router; 