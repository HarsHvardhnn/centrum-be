const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../utils/cloudinary");
const { FOLDERS, CLOUDINARY_CATEGORIES } = require("../constants/cloudinaryFolders");

function isDocumentFile(file) {
  return (
    file.mimetype === "application/pdf" ||
    file.mimetype?.includes("document") ||
    file.mimetype === "text/plain" ||
    file.type === "application/pdf" ||
    file.type?.includes("document") ||
    file.type === "text/plain"
  );
}

function folderForCategory(req, file) {
  const key = req.cloudinaryCategory || "misc";
  const def = CLOUDINARY_CATEGORIES[key] || CLOUDINARY_CATEGORIES.misc;
  const doc = isDocumentFile(file);
  return doc ? def.document : def.image;
}

const sharedStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const folderPath = folderForCategory(req, file);
    const isDocument = isDocumentFile(file);
    const params = {
      folder: folderPath,
      resource_type: isDocument ? "raw" : "image",
      allowed_formats: isDocument
        ? ["pdf", "doc", "docx", "txt"]
        : ["jpg", "jpeg", "png", "webp"],
      use_filename: false,
      unique_filename: true,
    };

    if (isDocument) {
      const parts = String(file.originalname || "").split(".");
      const fileExtension =
        parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "pdf";
      params.public_id = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExtension}`;
    }

    return params;
  },
});

/**
 * Set Cloudinary folder category for the next multer upload (must run before upload middleware).
 * @param {string} category - key of CLOUDINARY_CATEGORIES (e.g. "patient_record", "check_in")
 */
function cloudinaryCategory(category) {
  return (req, res, next) => {
    req.cloudinaryCategory = category;
    next();
  };
}

const upload = multer({
  storage: sharedStorage,
});

function createFixedStorage(folderName, fileType) {
  const params = {
    folder: folderName.startsWith("hospital_app") ? folderName : `hospital_app/${folderName}`,
    allowed_formats:
      fileType === "document"
        ? ["pdf", "doc", "docx", "txt"]
        : ["jpg", "jpeg", "png", "webp"],
    resource_type: fileType === "document" ? "raw" : "image",
    use_filename: false,
    unique_filename: true,
  };

  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: params,
  });
}

const imageUpload = multer({
  storage: createFixedStorage(FOLDERS.MISC_IMAGES, "image"),
});

const documentUpload = multer({
  storage: createFixedStorage(FOLDERS.APPOINTMENT_REPORTS_DOCUMENTS, "document"),
});

module.exports = {
  upload,
  cloudinaryCategory,
  imageUpload,
  documentUpload,
  FOLDERS,
  CLOUDINARY_CATEGORIES,
};
