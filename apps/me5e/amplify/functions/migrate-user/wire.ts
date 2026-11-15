import { RemovalPolicy, Stack } from 'aws-cdk-lib'
import { AttributeType, BillingMode, Table, type ITable } from 'aws-cdk-lib/aws-dynamodb'
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam'
import type { IFunction } from 'aws-cdk-lib/aws-lambda'
import { Bucket, HttpMethods } from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'
import { GEN1_MODELS } from '../../../migrate/gen1'

/** The live site's Gen 1 backend (plan/20 §5): read only, never written. */
export const GEN1_PROD = {
  suffix: 'ftks2bjjx5clvpa3j7hk2danwi-production',
  bucket: 'me5estorage194957-production',
}

/** The new tables the migration writes (Gen 2 models). */
const MODELS = ['Profile', 'Character', 'Bookmark', 'Homebrew', 'HomebrewUse', 'HomebrewVote'] as const

interface Wiring {
  fn: IFunction
  addEnvironment: (key: string, value: string) => void
  tables: Record<string, ITable>
  /** A stack for the sandbox's stand-in Gen 1 tables (only called for `fake`). */
  createStack: (name: string) => Stack
}

/**
 * Environment and IAM of `migrate-user` (plan/28 §1.4). `gen1: 'prod'` reads the live
 * tables and picture bucket (Amplify builds, which use the prod user pool); `'fake'` makes
 * empty stand-ins with the same keys and indexes (sandboxes, on the dev pool), so a
 * sandbox never reads real data. Returns the table and bucket names, for the sandbox test.
 */
export function wireMigration({ fn, addEnvironment, tables, createStack }: Wiring, gen1: 'prod' | 'fake') {
  const stack = Stack.of(fn)
  const arn = (name: string) => `arn:aws:dynamodb:${stack.region}:${stack.account}:table/${name}`

  let gen1Tables: Record<string, string>
  let gen1Bucket: string
  if (gen1 === 'prod') {
    gen1Tables = Object.fromEntries(GEN1_MODELS.map(m => [m, `${m}-${GEN1_PROD.suffix}`]))
    gen1Bucket = GEN1_PROD.bucket
  }
  else {
    const scope: Construct = createStack('gen1-standin')
    gen1Tables = {}
    for (const m of GEN1_MODELS) {
      const t = new Table(scope, `Gen1${m}`, { partitionKey: { name: 'id', type: AttributeType.STRING }, billingMode: BillingMode.PAY_PER_REQUEST, removalPolicy: RemovalPolicy.DESTROY })
      if (m !== 'Profile') t.addGlobalSecondaryIndex({ indexName: 'byUser', partitionKey: { name: 'owner', type: AttributeType.STRING } })
      gen1Tables[m] = t.tableName
    }
    // CORS as on the live bucket (GET from any origin), so the browser can copy a picture.
    gen1Bucket = new Bucket(scope, 'Gen1Pictures', { removalPolicy: RemovalPolicy.DESTROY, autoDeleteObjects: true, cors: [{ allowedMethods: [HttpMethods.GET, HttpMethods.HEAD], allowedOrigins: ['*'], allowedHeaders: ['*'] }] }).bucketName
  }

  addEnvironment('GEN1_TABLES', stack.toJsonString(gen1Tables))
  addEnvironment('GEN1_BUCKET', gen1Bucket)
  const newTables = Object.fromEntries(MODELS.map(m => [m, tables[m]!.tableName]))
  addEnvironment('TABLES', stack.toJsonString(newTables))

  // Gen 1: read only, and only these reads.
  fn.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['dynamodb:GetItem', 'dynamodb:BatchGetItem', 'dynamodb:Query'],
    resources: Object.values(gen1Tables).flatMap(name => [arn(name), `${arn(name)}/index/byUser`]),
  }))
  fn.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['s3:GetObject'],
    resources: [`arn:aws:s3:::${gen1Bucket}/public/*`],
  }))
  // New tables: read, create and update rows; never delete.
  fn.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['dynamodb:GetItem', 'dynamodb:BatchGetItem', 'dynamodb:Query', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
    resources: MODELS.flatMap(m => [tables[m]!.tableArn, `${tables[m]!.tableArn}/index/*`]),
  }))
  return { gen1Tables, gen1Bucket, tables: newTables }
}
