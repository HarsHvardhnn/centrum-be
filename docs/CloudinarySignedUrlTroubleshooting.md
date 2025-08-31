# Cloudinary Signed URL Troubleshooting

This document provides solutions to common issues when working with Cloudinary signed URLs.

## Common Issues and Solutions

### 1. "This res.cloudinary.com page can't be found" Error

If you're seeing a 404 error when trying to access a signed URL, check these common issues:

#### Public ID Format Issues

- **Problem**: Including file extensions in the public ID
- **Solution**: Remove file extensions when generating signed URLs. The extension should not be part of the public ID.

  ```javascript
  // Incorrect
  const publicId = "hospital_app/secure_documents/document.pdf";
  
  // Correct
  const publicId = "hospital_app/secure_documents/document";
  ```

#### Resource Type Mismatches

- **Problem**: Using the wrong resource type for the file (e.g., using 'image' for PDFs)
- **Solution**: Ensure you're using the correct resource type:
  - Use `resource_type: 'raw'` for PDFs, documents, and other non-image files
  - Use `resource_type: 'image'` for images (jpg, png, etc.)

  ```javascript
  // For documents (PDFs, DOC, TXT, etc.)
  cloudinary.url(publicId, {
    resource_type: 'raw',
    // other options...
  });
  
  // For images
  cloudinary.url(publicId, {
    resource_type: 'image',
    // other options...
  });
  ```

#### URL Expiration

- **Problem**: The signed URL has expired
- **Solution**: Generate a new signed URL with a future expiration time

  ```javascript
  // Set expiration to 1 hour from now
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  
  const signedUrl = generateSignedUrl(publicId, { expiresAt });
  ```

### 2. Testing Signed URLs

To test if your signed URL generation is working correctly:

1. Generate a signed URL through your API
2. Open the URL in a browser immediately
3. If it works, the file should display or download
4. If it fails, check the URL format and ensure:
   - The public ID is correct (no file extension)
   - The resource type matches the file type
   - The URL hasn't expired

### 3. Debugging Tips

If you're still having issues:

1. **Check Cloudinary Console**: Verify the file exists and check its actual public ID
2. **Inspect the URL**: Look for issues in the generated URL structure
3. **Try Direct API**: Use Cloudinary's direct API to generate a signed URL as a comparison
4. **Check Authentication**: Ensure your Cloudinary API key and secret are correct

```javascript
// Debug helper - log the components of your signed URL generation
function debugSignedUrl(publicId) {
  console.log("Original Public ID:", publicId);
  
  // Remove extension if present
  let cleanPublicId = publicId;
  if (publicId.includes('.')) {
    cleanPublicId = publicId.substring(0, publicId.lastIndexOf('.'));
  }
  console.log("Cleaned Public ID:", cleanPublicId);
  
  // Determine resource type
  const resourceType = publicId.endsWith('.pdf') ? 'raw' : 'image';
  console.log("Resource Type:", resourceType);
  
  // Generate URL
  const url = cloudinary.url(cleanPublicId, {
    type: "authenticated",
    sign_url: true,
    secure: true,
    resource_type: resourceType,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });
  console.log("Generated URL:", url);
  
  return url;
}
```

## Best Practices

1. **Store Clean Public IDs**: Store public IDs without file extensions in your database
2. **Determine Resource Type Automatically**: Use logic to determine the correct resource type based on file type
3. **Set Reasonable Expirations**: Use short expiration times for security, but not so short that users experience issues
4. **Handle Errors Gracefully**: Provide meaningful error messages when URL generation fails

