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
