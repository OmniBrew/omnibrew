import { defineData } from '@aws-amplify/backend'
import { schema } from '@omnibrew/backend'

export const data = defineData({
  schema,
  authorizationModes: {
    // Signed-in users; guests (shared character links, public homebrew) use the identity pool.
    defaultAuthorizationMode: 'userPool',
  },
})
