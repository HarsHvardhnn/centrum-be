const Doctor = require('../models/user-entity/doctor');

/**
 * Generate URL-friendly slug from text
 * @param {string} text - Text to convert to slug
 * @returns {string} - URL-friendly slug
 */
function generateSlug(text) {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .trim()
    // Replace Polish characters
    .replace(/ą/g, 'a')
    .replace(/ć/g, 'c')
    .replace(/ę/g, 'e')
    .replace(/ł/g, 'l')
    .replace(/ń/g, 'n')
    .replace(/ó/g, 'o')
    .replace(/ś/g, 's')
    .replace(/ź/g, 'z')
    .replace(/ż/g, 'z')
    // Replace special characters and spaces with dashes
    .replace(/[^a-z0-9]+/g, '-')
    // Remove leading/trailing dashes
    .replace(/^-+|-+$/g, '')
    // Replace multiple consecutive dashes with single dash
    .replace(/-+/g, '-');
}

/**
 * Generate slug from doctor's name
 * @param {Object} doctor - Doctor object with name.first and name.last
 * @returns {string} - Generated slug
 */
function generateDoctorSlug(doctor) {
  const firstName = doctor.name?.first || '';
  const lastName = doctor.name?.last || '';
  const fullName = `${firstName} ${lastName}`.trim();
  return generateSlug(fullName);
}

/**
 * Generate unique slug for doctor (handles duplicates)
 * @param {Object} doctor - Doctor object
 * @param {Object} DoctorModel - Doctor model for database queries
 * @returns {string} - Unique slug
 */
async function generateUniqueSlug(doctor, DoctorModel = Doctor) {
  let baseSlug = generateDoctorSlug(doctor);
  let slug = baseSlug;
  let counter = 1;
  
  // Keep trying until we find a unique slug
  while (await DoctorModel.findOne({ slug, _id: { $ne: doctor._id } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

/**
 * Validate slug format
 * @param {string} slug - Slug to validate
 * @returns {boolean} - Whether slug is valid
 */
function isValidSlug(slug) {
  if (!slug || typeof slug !== 'string') return false;
  
  // Check if slug matches expected format (lowercase letters, numbers, hyphens)
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug) && slug.length >= 2 && slug.length <= 100;
}


const ensureUniqueSlug = async (Model, baseSlug, excludeId = null) => {
  let slug = baseSlug;
  let counter = 1;
  
  const query = { slug };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  while (await Model.findOne(query)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
    query.slug = slug;
  }
  
  return slug;
};

module.exports = {
  generateSlug,
  generateDoctorSlug,
  generateUniqueSlug,ensureUniqueSlug,
  isValidSlug
}; 