import { a, defineData } from '@aws-amplify/backend'
import { contentEditorEntries, legacyMigrationEntries, schemaEntries } from '@omnibrew/backend'
import { contentEditor } from '../functions/content-editor/resource'
import { migrateUser } from '../functions/migrate-user/resource'

/** The shared schema, the Gen 1 migration (plan/28 §1), which only ME has, and the content editor (plan/33). */
export const schema = a.schema({ ...schemaEntries, ...legacyMigrationEntries(migrateUser), ...contentEditorEntries(contentEditor) })

export const data = defineData({
  schema,
  authorizationModes: {
    // Signed-in users; guests (shared character links, public homebrew) use the identity pool.
    defaultAuthorizationMode: 'userPool',
  },
})
