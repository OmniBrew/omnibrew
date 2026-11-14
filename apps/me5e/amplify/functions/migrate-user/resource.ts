import { fileURLToPath } from 'node:url'
import { defineFunction } from '@aws-amplify/backend'
import { writeMigrationContent } from './content'

// The handler imports content.json; write it before esbuild bundles the function.
writeMigrationContent(fileURLToPath(new URL('./content.json', import.meta.url)))

/**
 * `migrateMyData` and `getLegacyCharacter` (plan/28 §1). In the data stack
 * (`resourceGroupName`), since it is the API's resolver and reads the API's tables.
 * AppSync stops a resolver at 30 s; the handler hands what is left to the next call at 18 s.
 */
export const migrateUser = defineFunction({
  name: 'migrate-user',
  entry: './handler.ts',
  runtime: 24,
  architecture: 'arm64',
  memoryMB: 1024,
  timeoutSeconds: 28,
  resourceGroupName: 'data',
  logging: { format: 'json', retention: '1 month' },
})
