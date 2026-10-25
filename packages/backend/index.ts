import type { DynamoDbDataSource } from 'aws-cdk-lib/aws-appsync'
import type { Stack } from 'aws-cdk-lib'
import { type ITable, Table } from 'aws-cdk-lib/aws-dynamodb'
import { HOMEBREW_DATA_SOURCE, PROFILE_DATA_SOURCE } from './schema'

export * from './schema'

/**
 * An existing Cognito user pool the site signs in to (plan/20): a web client in that
 * pool and an identity pool federating it, with its two roles. A game passes it to
 * `referenceAuth` in its own amplify/auth/resource.ts (Amplify requires that file).
 */
export interface UserPoolReference {
  userPoolId: string
  userPoolClientId: string
  identityPoolId: string
  authRoleArn: string
  unauthRoleArn: string
}

/** The parts of `backend.data` that `configureData` uses. */
interface DataBackend {
  stack: Stack
  resources: { graphqlApi: { apiId: string } }
  addDynamoDbDataSource(id: string, table: ITable, options?: { name?: string }): DynamoDbDataSource
}

/**
 * Adds the data sources of the custom resolvers in `schemaEntries`, after `defineBackend`.
 * The tables are imported by name, because referencing the managed tables from the API
 * makes a dependency cycle. Gen 2 names a model's table `<Model>-<api id>-NONE`, in a
 * sandbox and on a branch alike (the resolvers build the same names).
 */
export function configureData(data: DataBackend) {
  const { stack } = data
  const table = (model: string, globalIndexes: string[] = []) => Table.fromTableAttributes(stack, `${model}ResolverTable`, {
    tableName: `${model}-${data.resources.graphqlApi.apiId}-NONE`,
    globalIndexes,
  })

  const homebrew = data.addDynamoDbDataSource(HOMEBREW_DATA_SOURCE, table('Homebrew', ['byOwner', 'byKind']), { name: HOMEBREW_DATA_SOURCE })
  table('HomebrewUse').grantReadWriteData(homebrew)
  table('HomebrewVote').grantReadWriteData(homebrew)
  data.addDynamoDbDataSource(PROFILE_DATA_SOURCE, table('Profile'), { name: PROFILE_DATA_SOURCE })
}
