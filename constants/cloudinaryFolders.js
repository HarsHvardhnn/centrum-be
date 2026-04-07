/**
 * Cloudinary folder layout under hospital_app/.
 * New uploads are routed here by category (see middlewares/cloudinaryUpload.js).
 * Existing files under legacy paths (e.g. hospital_app/documents) remain valid in Cloudinary.
 */

const ROOT = "hospital_app";

const FOLDERS = {
  BRANDING_LOGOS: `${ROOT}/branding/logos`,

  PATIENT_RECORD_DOCUMENTS: `${ROOT}/patients/record_documents`,
  PATIENT_PROFILE_IMAGES: `${ROOT}/patients/profile_images`,

  CHECK_IN_DOCUMENTS: `${ROOT}/check_ins/documents`,
  CHECK_IN_IMAGES: `${ROOT}/check_ins/images`,

  VISIT_REGISTRATION_DOCUMENTS: `${ROOT}/visits/registration/documents`,
  VISIT_REGISTRATION_IMAGES: `${ROOT}/visits/registration/images`,

  APPOINTMENT_REPORTS_DOCUMENTS: `${ROOT}/appointments/reports/documents`,
  APPOINTMENT_REPORTS_IMAGES: `${ROOT}/appointments/reports/images`,

  VISIT_CARDS: `${ROOT}/visit_cards`,

  BILLING_INVOICES: `${ROOT}/billing/invoices`,

  STAFF_DOCTOR_PHOTOS: `${ROOT}/staff/doctors/photos`,
  STAFF_DOCTOR_DOCUMENTS: `${ROOT}/staff/doctors/documents`,

  USER_PROFILE: `${ROOT}/users/profile`,

  CMS_NEWS: `${ROOT}/cms/news`,

  CHAT_ATTACHMENTS: `${ROOT}/chat/attachments`,

  ADMIN_UPLOADS: `${ROOT}/admin/uploads`,

  SERVICES_IMAGES: `${ROOT}/services/images`,

  MISC_DOCUMENTS: `${ROOT}/misc/documents`,
  MISC_IMAGES: `${ROOT}/misc/images`,
};

/**
 * Maps req.cloudinaryCategory → { document, image } Cloudinary folder paths.
 * "document" / "image" picked from MIME in cloudinaryUpload.
 */
const CLOUDINARY_CATEGORIES = {
  branding_logo: {
    document: FOLDERS.MISC_DOCUMENTS,
    image: FOLDERS.BRANDING_LOGOS,
  },
  patient_record: {
    document: FOLDERS.PATIENT_RECORD_DOCUMENTS,
    image: FOLDERS.PATIENT_PROFILE_IMAGES,
  },
  patient_details: {
    document: FOLDERS.PATIENT_RECORD_DOCUMENTS,
    image: FOLDERS.PATIENT_PROFILE_IMAGES,
  },
  check_in: {
    document: FOLDERS.CHECK_IN_DOCUMENTS,
    image: FOLDERS.CHECK_IN_IMAGES,
  },
  visit_registration: {
    document: FOLDERS.VISIT_REGISTRATION_DOCUMENTS,
    image: FOLDERS.VISIT_REGISTRATION_IMAGES,
  },
  appointment_report: {
    document: FOLDERS.APPOINTMENT_REPORTS_DOCUMENTS,
    image: FOLDERS.APPOINTMENT_REPORTS_IMAGES,
  },
  doctor: {
    document: FOLDERS.STAFF_DOCTOR_DOCUMENTS,
    image: FOLDERS.STAFF_DOCTOR_PHOTOS,
  },
  user_profile: {
    document: FOLDERS.MISC_DOCUMENTS,
    image: FOLDERS.USER_PROFILE,
  },
  news: {
    document: FOLDERS.MISC_DOCUMENTS,
    image: FOLDERS.CMS_NEWS,
  },
  chat: {
    document: FOLDERS.CHAT_ATTACHMENTS,
    image: FOLDERS.CHAT_ATTACHMENTS,
  },
  admin: {
    document: FOLDERS.ADMIN_UPLOADS,
    image: FOLDERS.ADMIN_UPLOADS,
  },
  service: {
    document: FOLDERS.MISC_DOCUMENTS,
    image: FOLDERS.SERVICES_IMAGES,
  },
  image_gallery: {
    document: FOLDERS.MISC_DOCUMENTS,
    image: FOLDERS.MISC_IMAGES,
  },
  misc: {
    document: FOLDERS.MISC_DOCUMENTS,
    image: FOLDERS.MISC_IMAGES,
  },
};

module.exports = {
  ROOT,
  FOLDERS,
  CLOUDINARY_CATEGORIES,
};
