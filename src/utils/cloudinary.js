import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudinaryUploader = async localFilePath => {
  try {
    if (!localFilePath) {
      return null;
    }
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: 'auto',
    });
    // console.log('File uploaded successfully', response.url);
    fs.unlinkSync(localFilePath); // Remove the local file after upload
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath);
    return null;
  }
};

// Function to extract public_id from Cloudinary URL
const extractPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  try {
    // Extract the public_id from the Cloudinary URL
    // Format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/public_id.extension
    const urlParts = url.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    
    if (uploadIndex === -1) return null;
    
    // Get everything after 'upload' and before the file extension
    const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
    // Remove version if present (starts with v followed by numbers)
    const withoutVersion = pathAfterUpload.replace(/^v\d+\//, '');
    // Remove file extension
    const publicId = withoutVersion.replace(/\.[^/.]+$/, '');
    
    return publicId;
  } catch (error) {
    console.error('Error extracting public_id from URL:', error);
    return null;
  }
};

// Function to delete image from Cloudinary
const cloudinaryDeleter = async (imageUrl) => {
  try {
    if (!imageUrl) return null;
    
    const publicId = extractPublicIdFromUrl(imageUrl);
    if (!publicId) {
      console.log('Could not extract public_id from URL:', imageUrl);
      return null;
    }
    
    const response = await cloudinary.uploader.destroy(publicId);
    console.log('Image deleted from Cloudinary:', response);
    return response;
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    return null;
  }
};

export { cloudinaryUploader, cloudinaryDeleter };