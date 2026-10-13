import * as ImageManipulator from 'expo-image-manipulator';

const CLOUDINARY_CLOUD_NAME =
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'secondhome_unsigned_preset';

/**
 * Compresses image (max width 1280px, quality 0.7, JPEG) and uploads to Cloudinary.
 * Returns the hosted secure URL.
 */
export const compressAndUploadImage = async (uri: string): Promise<string> => {
  if (!CLOUDINARY_CLOUD_NAME) {
    throw new Error(
      'Cloudinary cloud name is not configured. Please set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME in .env'
    );
  }

  // 1. Compress and resize image
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  // 2. Prepare multipart upload
  const formData = new FormData();
  formData.append('file', {
    uri: manipulated.uri,
    type: 'image/jpeg',
    name: `upload_${Date.now()}.jpg`,
  } as any);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  // 3. Upload to Cloudinary REST API
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to upload image to Cloudinary');
  }

  return data.secure_url;
};
