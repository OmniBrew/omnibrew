import { a, defineData } from '@aws-amplify/backend'
import { legacyMigrationEntries, schemaEntries } from '@omnibrew/backend'
import { migrateUser } from '../functions/migrate-user/resource'

/** The shared schema plus the Gen 1 migration (plan/28 §1), which only ME has. */
export const schema = a.schema({ ...schemaEntries, ...legacyMigrationEntries(migrateUser) })

export const data = defineData({
  schema,
  authorizationModes: {
    // Signed-in users; guests (shared character links, public homebrew) use the identity pool.
    defaultAuthorizationMode: 'userPool',
  },
})
