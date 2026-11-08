/**
 * Profile pictures (plan/26 §1.2, decision 5): resized in the browser to a 256 px square
 * WebP of at most 50 KB, then stored in the app's Amplify Storage bucket under the
 * user's identity (`profile-pictures/{identityId}/…`). Shown through a signed URL, on the
 * profile page only, so no other page loads Amplify Storage.
 */
export const PICTURE_SIZE = 256
export const PICTURE_MAX_BYTES = 50_000
/** Files larger than this are refused before decoding. */
export const PICTURE_MAX_INPUT_BYTES = 10_000_000

/** The square crop of a `width` × `height` image: its centered largest square. */
export function squareCrop(width: number, height: number) {
  const side = Math.min(width, height)
  return { sx: Math.floor((width - side) / 2), sy: Math.floor((height - side) / 2), side }
}

/** Why a file can't be a picture (an i18n key), or null. */
export function pictureFileError(file: Pick<File, 'type' | 'size'>): string | null {
  if (!/^image\/(?:png|jpe?g|webp|gif|avif)$/.test(file.type)) return 'profile.picture.wrong_type'
  if (file.size > PICTURE_MAX_INPUT_BYTES) return 'profile.picture.too_big'
  return null
}

/** Draws the file's centered square at 256 px and encodes WebP, lowering quality until it fits 50 KB. */
export async function resizePicture(file: Blob): Promise<Blob> {
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
export async function uploadPicture(blob: Blob): Promise<string> {
  const { uploadData } = await import('aws-amplify/storage')
  const result = await uploadData({
    path: ({ identityId }) => `profile-pictures/${identityId}/${Date.now()}.webp`,
    data: blob,
    options: { contentType: 'image/webp' },
  }).result
  return result.path
}

export async function pictureUrl(path: string): Promise<string> {
  const { getUrl } = await import('aws-amplify/storage')
  return (await getUrl({ path, options: { expiresIn: 3600 } })).url.toString()
}

export async function removePicture(path: string) {
  const { remove } = await import('aws-amplify/storage')
  await remove({ path })
}
