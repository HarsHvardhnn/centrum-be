# Cloudinary Signed URL Implementation

This document explains how the signed URL implementation works with Cloudinary in our application.

## How It Works

1. Files are uploaded to Cloudinary with the `type: "authenticated"` parameter
2. This means the files can only be accessed using signed URLs
3. Our server generates these signed URLs using our Cloudinary API secret
4. Only our server can generate valid signed URLs, making the files secure

## Usage Example

### Uploading Files

```javascript
const { upload } = require("../middlewares/cloudinaryUpload");

// Use in your route handlers
router.post("/upload", upload.single("file"), (req, res) => {
  // req.file contains the uploaded file information, including:
  // - req.file.path: The Cloudinary URL (but this is not signed)
  // - req.file.filename: The public ID in Cloudinary
  
  // Store the public ID in your database, not the direct URL
  const publicId = req.file.filename;
  
  // Return success response
  res.status(200).json({
    success: true,
    message: "File uploaded successfully",
    fileId: publicId
  });
});
```

### Retrieving Files with Signed URLs

```javascript
const { generateSignedUrl } = require("../middlewares/cloudinaryUpload");

// In your controller that needs to access files
router.get("/files/:fileId", (req, res) => {
  const publicId = req.params.fileId;
  
  // Generate a signed URL that expires in 1 hour
  const signedUrl = generateSignedUrl(publicId);
  
  // Or with custom expiration (e.g., 30 minutes)
  const customExpiryUrl = generateSignedUrl(publicId, {
    expiresAt: Math.floor(Date.now() / 1000) + (30 * 60)
  });
  
  // Or with transformations
  const transformedUrl = generateSignedUrl(publicId, {
    transformation: [
      { width: 300, height: 300, crop: 'fill' }
    ]
  });
  
  // Return the signed URL to the client
  res.status(200).json({
    success: true,
    url: signedUrl
  });
});
```

## Security Considerations

1. Never store the direct Cloudinary URLs in your database, only store the public IDs
2. Always generate signed URLs on-demand when needed
3. Set appropriate expiration times for the signed URLs
4. The Cloudinary API secret is only used on the server side and never exposed to clients
5. Consider using IP restrictions in Cloudinary for additional security

## Benefits

- Files cannot be accessed directly, even if someone discovers the URL pattern
- Access to files can be time-limited
- You can revoke access to files by changing your Cloudinary API secret (though this affects all files)
- You can track and control file access through your application


