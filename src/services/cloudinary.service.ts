import { v2 as cloudinary, UploadApiResponse, ConfigOptions } from 'cloudinary';
import CustomError from '../errors/customError.error';
import { HttpStatusCode } from 'axios';
import { Readable } from 'stream';

/**
 * Interface for the response our service will return.
 * We only include the fields we need.
 */
export interface CloudinaryUploadResult {
  secure_url: string; // The HTTPS URL (this is what Facebook needs!)
  public_id: string;  // The ID to delete the image if necessary
  format: string;
  width: number;
  height: number;
}

export class CloudinaryService {
  private config: ConfigOptions;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    // 1. Validate that credentials exist
    if (!cloudName || !apiKey || !apiSecret) {
      console.error('[CloudinaryService] ❌ Error: Missing Cloudinary environment variables.');
      throw new Error('Cloudinary configuration is incomplete. Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET');
    }

    // 2. Configure the Cloudinary instance
    this.config = {
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true // Always use HTTPS
    };
    
    cloudinary.config(this.config);
    
    console.log(`[CloudinaryService] ✅ Cloudinary service configured for cloud: ${cloudName}`);
  }

  /**
   * Upload a file (from a buffer) to Cloudinary.
   * We use 'upload_stream' which is the modern way to handle buffers in Node.js
   * * @param fileBuffer The file buffer (e.g. req.file.buffer from multer)
   * @param folder The folder in Cloudinary where it will be saved (e.g. 'facebook_posts')
   * @returns A promise that resolves with the uploaded image details.
   */
  async uploadImage(fileBuffer: Buffer, folder: string = 'posts'): Promise<CloudinaryUploadResult> {
    
    console.log(`[CloudinaryService] ☁️ Uploading image to folder: ${folder}...`);

    // We use a Promise to wrap the stream so we can use async/await
    return new Promise<CloudinaryUploadResult>((resolve, reject) => {
      
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,       // Destination folder
          resource_type: 'auto' // Detects if it's image, video, etc.
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error) {
            console.error('[CloudinaryService] ❌ Upload stream error:', error.message);
            return reject(new CustomError(error.message, HttpStatusCode.InternalServerError));
          }

          if (!result) {
            console.error('[CloudinaryService] ❌ Upload returned no result.');
            return reject(new CustomError('Cloudinary returned no result.', HttpStatusCode.InternalServerError));
          }
          
          console.log(`[CloudinaryService] ✅ Image uploaded successfully. Public ID: ${result.public_id}`);
          
          // Resolve the promise with the data we care about
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height
          });
        }
      );

      // Convert the buffer to a readable stream and pipe it to the upload stream
      const readableStream = new Readable();
      readableStream.push(fileBuffer);
      readableStream.push(null); // End of stream
      
      readableStream.pipe(uploadStream);
    });
  }

  /**
   * (Optional but recommended) Delete a file from Cloudinary using its public_id
   */
  async deleteImage(publicId: string): Promise<{ result: string }> {
    try {
      console.log(`[CloudinaryService] 🗑️ Deleting image: ${publicId}`);
      const result = await cloudinary.uploader.destroy(publicId);
      console.log(`[CloudinaryService] ✅ Image deleted.`);
      return result;
    } catch (error: any) {
      console.error('[CloudinaryService] ❌ Error deleting image:', error.message);
      throw new CustomError(error.message, HttpStatusCode.InternalServerError);
    }
  }
}

// Export a single 'singleton' instance of the service
export const cloudinaryService = new CloudinaryService();