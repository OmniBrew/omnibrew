import { referenceAuth } from '@aws-amplify/backend'
import type { UserPoolReference } from '@omnibrew/backend'

/**
 * The live site's Cognito pools (Gen 1 `me5eauth`), so users keep their accounts and
 * owner ids (plan/20). The `me5e-web` clients, identity pools and roles were made for
 * the new site; the Gen 1 clients and identity pools are untouched.
 */
const pools = {
  // Gen 1 `production`: every real account.
  prod: {
    userPoolId: 'us-east-1_fprSLNMEB',
    userPoolClientId: '2g8u58l3233t59t5mqkon07c16',
    identityPoolId: 'us-east-1:dfd3e147-3200-4b9e-aee4-ad00248f61f2',
    authRoleArn: 'arn:aws:iam::168036140514:role/me5e-web-prod-auth',
    unauthRoleArn: 'arn:aws:iam::168036140514:role/me5e-web-prod-unauth',
  },
  // Gen 1 `dev`: sandboxes, and the test accounts that go with them.
  dev: {
    userPoolId: 'us-east-1_cMjZGTk9o',
    userPoolClientId: '10gppvsm7am9r7cghjv3msacd0',
    identityPoolId: 'us-east-1:f5281be4-1598-46b5-9304-36d269d81726',
    authRoleArn: 'arn:aws:iam::168036140514:role/me5e-web-dev-auth',
    unauthRoleArn: 'arn:aws:iam::168036140514:role/me5e-web-dev-unauth',
  },
} satisfies Record<string, UserPoolReference>

/**
 * Amplify Hosting builds (AWS_BRANCH set) use the prod pool; sandboxes use dev.
 * `ME5E_USER_POOL=prod|dev` overrides it.
 */
const pool = (process.env.ME5E_USER_POOL ?? (process.env.AWS_BRANCH ? 'prod' : 'dev')) as keyof typeof pools

export const auth = referenceAuth(pools[pool])
