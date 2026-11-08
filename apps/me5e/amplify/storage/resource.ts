import { defineStorage } from '@aws-amplify/backend'

/**
 * Files players upload (plan/26 §1.2): profile pictures, a 256 px WebP of at most 50 KB each,
 * under the uploader's identity id. Every signed-in user and guest may read them (the profile
 * page shows them through signed URLs); only their owner writes or deletes.
 */
export const storage = defineStorage({
  name: 'me5eUserFiles',
  access: allow => ({
    'profile-pictures/{entity_id}/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read']),
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
  }),
})
