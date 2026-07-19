// Configures the Cloudinary SDK (used for uploading/hosting room photos,
// receipts, etc.) using credentials from environment variables, and exports
// the configured client for the rest of the app to use.
import { v2 as cloudinary } from 'cloudinary'; // "v2" is Cloudinary's current API version, aliased to a shorter name

// Credentials must be set in the environment (.env) — never hardcoded here.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Export the already-configured instance so every other file that needs to
// upload/manage images just imports this instead of re-configuring it.
export default cloudinary;
