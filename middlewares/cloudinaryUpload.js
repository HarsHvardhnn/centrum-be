const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../utils/cloudinary");

// Create different storage configurations based on file type
const createStorage = (folderName, fileType) => {
  const params = {
    folder: `hospital_app/${folderName}`,
    allowed_formats:
      fileType === "document"
        ? ["pdf", "doc", "docx", "txt"]
        : ["jpg", "jpeg", "png", "webp"],
    resource_type: fileType === "document" ? "raw" : "image",
  };

  // Only apply transformations to images
  if (fileType === "image") {
    params.transformation = [{ width: 500, height: 500, crop: "limit" }];
  }

  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: params,
  });
};

// Create specialized upload instances
const imageUpload = multer({
  storage: createStorage("images", "image"),
});

const documentUpload = multer({
  storage: createStorage("visit_cards", "document"),
});

// General purpose upload with type detection
const upload = multer({
  storage: new CloudinaryStorage({
    cloudinary: cloudinary,
    params: (req, file) => {
      // Determine file type based on mimetype
      const isDocument =
        file.mimetype === "application/pdf" ||
        file.mimetype?.includes("document") ||
        file.mimetype === "text/plain" ||
        file.type === "application/pdf" ||
        file.type?.includes("document") ||
        file.type === "text/plain";

      const folderPath = isDocument
        ? "hospital_app/documents"
        : "hospital_app/images";
      const resourceType = isDocument ? "raw" : "image";
      const params = {
        folder: folderPath,
        resource_type: resourceType,
        allowed_formats: isDocument
          ? ["pdf", "doc", "docx", "txt"]
          : ["jpg", "jpeg", "png", "webp"],
      };

      // For documents, preserve the original filename and extension
      if (isDocument) {
        // Extract file extension
        const fileExtension = file.originalname.split('.').pop().toLowerCase();
        params.public_id = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExtension}`;
        params.use_filename = true;
        params.unique_filename = false;
      }

      // Only apply transformations to images
      if (!isDocument) {
        params.transformation = [{ width: 500, height: 500, crop: "limit" }];
      }

      return params;
    },
  }),
});

module.exports = {
  upload, // General purpose upload
  imageUpload, // Specialized for images
  documentUpload, // Specialized for PDFs and other documents
};
