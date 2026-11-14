import { defineBackend } from '@aws-amplify/backend'
import { configureData } from '@omnibrew/backend'
import { auth, pool } from './auth/resource'
import { data } from './data/resource'
import { migrateUser } from './functions/migrate-user/resource'
import { wireMigration } from './functions/migrate-user/wire'
import { storage } from './storage/resource'

const backend = defineBackend({ auth, data, storage, migrateUser })

configureData(backend.data)

// The Gen 1 migration (plan/28): the live tables on the prod pool; stand-ins on the dev pool (sandboxes).
const gen1 = wireMigration({
  fn: backend.migrateUser.resources.lambda,
  addEnvironment: (key, value) => backend.migrateUser.addEnvironment(key, value),
  tables: backend.data.resources.tables,
  createStack: name => backend.createStack(name),
}, pool === 'prod' ? 'prod' : 'fake')
// Who may migrate yet (plan/28 B139): the app's ME5E_MIGRATION_ALLOW (subs or usernames, or `*`); everyone when unset.
backend.migrateUser.addEnvironment('MIGRATION_ALLOW', process.env.ME5E_MIGRATION_ALLOW ?? '*')
// The sandbox test fills the stand-ins with generated rows; it finds them in amplify_outputs.json.
if (pool !== 'prod') backend.addOutput({ custom: { gen1 } })

// Point-in-time recovery on the real tables (plan/28 §4.1: ~$0.20 per GB-month, a few cents
// here); sandboxes hold only test rows.
if (pool === 'prod') {
  for (const table of Object.values(backend.data.resources.cfnResources.amplifyDynamoDbTables)) table.pointInTimeRecoveryEnabled = true
}
