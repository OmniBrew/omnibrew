import { PICTURE_MAX_BYTES, PICTURE_SIZE, squareCrop } from '../utils/profile-picture'

/**
 * Profile picture files in the browser (plan/26 §1.2): resizing, and Amplify Storage loaded
 * on demand. Used by the profile page only.
 */
export function useProfilePicture() {
  return { resizePicture, uploadPicture, pictureUrl, removePicture }
}

/** Draws the file's centered square at 256 px and encodes WebP, lowering quality until it fits 50 KB. */
async function resizePicture(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height)
  const canvas = new OffscreenCanvas(PICTURE_SIZE, PICTURE_SIZE)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('no canvas')
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, PICTURE_SIZE, PICTURE_SIZE)
  bitmap.close()
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality })
    if (blob.size <= PICTURE_MAX_BYTES) return blob
  }
  throw new Error('picture too large after resizing')
}

/** Amplify Storage for the picture, loaded on demand. */
async function uploadPicture(blob: Blob): Promise<string> {
  const { uploadData } = await import('aws-amplify/storage')
  const result = await uploadData({
    path: ({ identityId }) => `profile-pictures/${identityId}/${Date.now()}.webp`,
    data: blob,
    options: { contentType: 'image/webp' },
  }).result
  return result.path
}

async function pictureUrl(path: string): Promise<string> {
  const { getUrl } = await import('aws-amplify/storage')
  return (await getUrl({ path, options: { expiresIn: 3600 } })).url.toString()
}

async function removePicture(path: string) {
  const { remove } = await import('aws-amplify/storage')
  await remove({ path })
}
