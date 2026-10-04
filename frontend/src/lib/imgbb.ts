/**
 * ImgBB Image Upload Utility
 * The key comes from NEXT_PUBLIC_IMGBB_API_KEY (frontend/.env.local); never hard-code it.
 */

const IMGBB_API_KEY = process.env.NEXT_PUBLIC_IMGBB_API_KEY;

export interface ImgBBUploadResponse {
  data: {
    id: string;
    title: string;
    url_viewer: string;
    url: string;
    display_url: string;
    width: number;
    height: number;
    size: number;
    time: number;
    expiration: number;
    image: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    thumb: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    medium?: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    delete_url: string;
  };
  success: boolean;
  status: number;
}

export async function uploadImageToImgBB(file: File): Promise<string> {
  if (!IMGBB_API_KEY) {
    throw new Error('Image uploads are not configured: set NEXT_PUBLIC_IMGBB_API_KEY.');
  }

  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    throw new Error(errData?.error?.message || 'Failed to upload image to ImgBB.');
  }

  const result: ImgBBUploadResponse = await response.json();
  return result.data.display_url || result.data.url;
}
