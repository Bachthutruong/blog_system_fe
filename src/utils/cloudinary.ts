import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

export const compressAndUploadImage = async (
  buffer: Buffer,
  imageName: string,
  quality: number = 80,
  mimetype?: string
): Promise<UploadResult> => {
  try {
    // Determine output format based on input
    const normalizedMime = (mimetype || '').toLowerCase();
    const format = normalizedMime.includes('png')
      ? 'png'
      : normalizedMime.includes('webp')
        ? 'webp'
        : 'jpeg';

    // Compress image using Sharp
    const pipeline = sharp(buffer)
      .rotate()
      .resize(1600, 1200, {
        fit: 'inside',
        withoutEnlargement: true,
      });

    const compressedBuffer = await pipeline
      .toFormat(format as any, { quality })
      .toBuffer();

    // Upload to Cloudinary
    const result = await new Promise<UploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'blog-images',
          public_id: `blog_${Date.now()}_${imageName.replace(/\s+/g, '_')}`,
          transformation: [{ quality: 'auto:good', fetch_format: 'auto' }]
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              width: result.width || 0,
              height: result.height || 0
            });
          }
        }
      );

      uploadStream.end(compressedBuffer);
    });

    return result;
  } catch (error) {
    throw new Error(`Failed to compress and upload image: ${error}`);
  }
};

export const deleteImage = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(`Failed to delete image ${publicId}:`, error);
  }
};

export const deleteMultipleImages = async (publicIds: string[]): Promise<void> => {
  try {
    await Promise.all(publicIds.map(publicId => deleteImage(publicId)));
  } catch (error) {
    console.error('Failed to delete multiple images:', error);
  }
};
