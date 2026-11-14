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
// The sandbox test fills the stand-ins with generated rows; it finds them in amplify_outputs.json.
if (pool !== 'prod') backend.addOutput({ custom: { gen1 } })
