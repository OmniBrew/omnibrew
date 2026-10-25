import { a, type ClientSchema } from '@aws-amplify/backend'

/**
 * The user data every game shares (plan/20). A game's backend builds its schema from
 * these entries (`a.schema({ ...schemaEntries, ...its own })`), so the engine's data
 * layer can rely on them.
 *
 * Owners are stored as Amplify writes them, `<sub>::<username>`; owner rules also
 * accept a bare sub or username (the Gen 1 rows), so migrated records keep working.
 * Custom resolvers take the owner from the caller's token, never from arguments.
 */

/** Data source the homebrew resolvers run on (the Homebrew table, see `configureBackend`). */
export const HOMEBREW_DATA_SOURCE = 'HomebrewResolverDataSource'
/** Data source of the profile resolver (the Profile table). */
export const PROFILE_DATA_SOURCE = 'ProfileResolverDataSource'

// A model with any field-level rule needs rules on every declared required field too, so
// those fields repeat their model's owner/admin rules. A field rule never grants others
// `read`: that would open `list` to them. The `owner` field is read-only after creation
// (no reassignment) where field rules are already needed.

export const schemaEntries = {
  HomebrewStatus: a.enum(['private', 'development', 'published']),

  // No field-level rules here: a field `read` rule also opens `list`, and anyone may get
  // a character by id (shared links) but nobody may list others'.
  Character: a.model({
    id: a.id().required(),
    owner: a.string(),
    game: a.string().required(),
    /** The character model version (`character.version`). */
    version: a.integer().required(),
    name: a.string(),
    /** The character model (engine `character/`), validated by the data layer. */
    data: a.json().required(),
    /** The old-character migrator's report (Phase 3d). */
    migration: a.json(),
  })
    .secondaryIndexes(index => [index('owner').name('byOwner').queryField('listCharacterByOwner')])
    .authorization(allow => [
      allow.owner(),
      // Shared links: anyone with the id may read it, nobody may list.
      allow.authenticated().to(['get']),
      allow.guest().to(['get']),
    ]),

  // The id is the owner's Cognito sub, written by `ensureProfile` (owners can't create).
  // Not declared: a declared required field would need field rules, and a field `read`
  // rule for signed-in users would let them list every profile.
  Profile: a.model({
    owner: a.string().authorization(allow => [allow.owner().to(['read', 'delete']), allow.group('admins').to(['read', 'delete'])]),
    username: a.string(),
    profileImg: a.string(),
    preferences: a.json(),
    contactMethod: a.string(),
    contactValue: a.string(),
    // Discord webhook URLs: their owner's only (any signed-in user could read them on Gen 1).
    webhooks: a.json().authorization(allow => [allow.owner().to(['read', 'update', 'delete'])]),
    maxCharacters: a.integer().authorization(allow => [allow.owner().to(['read', 'delete']), allow.group('admins')]),
    /** The Gen 1 profile id (the Cognito username), set by the Phase 3d migration. */
    legacyId: a.string(),
    migratedAt: a.datetime(),
  })
    .authorization(allow => [
      allow.owner().to(['read', 'update', 'delete']),
      allow.authenticated().to(['get']),
      allow.group('admins'),
    ]),

  Bookmark: a.model({
    owner: a.string().authorization(allow => [allow.owner().to(['read', 'delete'])]),
    /** Content type, e.g. `powers`. */
    type: a.string().required().authorization(allow => [allow.owner()]),
    recordId: a.string().required().authorization(allow => [allow.owner()]),
    data: a.json(),
  })
    .secondaryIndexes(index => [index('owner').name('byOwner').queryField('listBookmarkByOwner')])
    .authorization(allow => [allow.owner()]),

  Homebrew: a.model({
    owner: a.string().authorization(allow => [allow.owner().to(['read', 'delete']), allow.group('admins').to(['read', 'delete'])]),
    /** Content type of the record, e.g. `weapons`. */
    kind: a.string().required().authorization(allow => [allow.owner(), allow.group('admins')]),
    title: a.string().required().authorization(allow => [allow.owner(), allow.group('admins')]),
    slug: a.string().required().authorization(allow => [allow.owner(), allow.group('admins')]),
    /** The record, in the content format of its kind. */
    data: a.json().required().authorization(allow => [allow.owner(), allow.group('admins')]),
    status: a.ref('HomebrewStatus').required().authorization(allow => [allow.owner(), allow.group('admins')]),
    official: a.boolean().authorization(allow => [allow.owner().to(['read', 'delete']), allow.group('admins')]),
    // Kept by setHomebrewUse / setHomebrewVote only. (Deleting a record needs `delete` on
    // every field with field rules.)
    usageCount: a.integer().authorization(allow => [allow.owner().to(['read', 'delete']), allow.group('admins').to(['read', 'delete'])]),
    voteCount: a.integer().authorization(allow => [allow.owner().to(['read', 'delete']), allow.group('admins').to(['read', 'delete'])]),
  })
    .secondaryIndexes(index => [
      index('owner').name('byOwner').queryField('listHomebrewByOwner'),
      index('kind').sortKeys(['status']).name('byKind').queryField('listHomebrewByKind'),
    ])
    // Other signed-in users read published and in-development homebrew through `getPublicHomebrew`
    // and `listPublicHomebrew`, which never return private items (guests can't call
    // custom JS resolvers; signed-in only, as on the live site).
    .authorization(allow => [allow.owner(), allow.group('admins')]),

  // Rows are created and removed only by `setHomebrewUse` / `setHomebrewVote`
  // (id `<sub>#<homebrewId>`), which keep the counts on the homebrew.
  HomebrewUse: a.model({
    owner: a.string(),
    homebrewId: a.id().required(),
  })
    .secondaryIndexes(index => [index('owner').name('byOwner').queryField('listHomebrewUseByOwner')])
    .authorization(allow => [allow.owner().to(['read'])]),

  HomebrewVote: a.model({
    owner: a.string(),
    homebrewId: a.id().required(),
  })
    .secondaryIndexes(index => [index('owner').name('byOwner').queryField('listHomebrewVoteByOwner')])
    .authorization(allow => [allow.owner().to(['read'])]),

  PublicHomebrew: a.customType({
    id: a.id().required(),
    /** The author's profile id (Cognito sub). */
    authorId: a.string(),
    kind: a.string().required(),
    title: a.string().required(),
    slug: a.string().required(),
    data: a.json().required(),
    status: a.ref('HomebrewStatus').required(),
    official: a.boolean(),
    usageCount: a.integer(),
    voteCount: a.integer(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  }),

  PublicHomebrewPage: a.customType({
    items: a.ref('PublicHomebrew').array().required(),
    nextToken: a.string(),
  }),

  HomebrewTally: a.customType({
    homebrewId: a.id().required(),
    usageCount: a.integer().required(),
    voteCount: a.integer().required(),
    /** Whether the caller now uses (or votes for) it. (`on` would break AppSync's schema parser.) */
    active: a.boolean().required(),
  }),

  getPublicHomebrew: a.query()
    .arguments({ id: a.id().required() })
    .returns(a.ref('PublicHomebrew'))
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.custom({ dataSource: HOMEBREW_DATA_SOURCE, entry: './resolvers/get-public-homebrew.js' })),

  listPublicHomebrew: a.query()
    .arguments({
      kind: a.string().required(),
      /** `published` (the default) or `development`. */
      status: a.ref('HomebrewStatus'),
      limit: a.integer(),
      nextToken: a.string(),
    })
    .returns(a.ref('PublicHomebrewPage').required())
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.custom({ dataSource: HOMEBREW_DATA_SOURCE, entry: './resolvers/list-public-homebrew.js' })),

  setHomebrewUse: a.mutation()
    .arguments({ homebrewId: a.id().required(), active: a.boolean().required() })
    .returns(a.ref('HomebrewTally').required())
    .authorization(allow => [allow.authenticated()])
    .handler([
      a.handler.custom({ dataSource: HOMEBREW_DATA_SOURCE, entry: './resolvers/load-homebrew.js' }),
      a.handler.custom({ dataSource: HOMEBREW_DATA_SOURCE, entry: './resolvers/tally-homebrew.js' }),
    ]),

  setHomebrewVote: a.mutation()
    .arguments({ homebrewId: a.id().required(), active: a.boolean().required() })
    .returns(a.ref('HomebrewTally').required())
    .authorization(allow => [allow.authenticated()])
    .handler([
      a.handler.custom({ dataSource: HOMEBREW_DATA_SOURCE, entry: './resolvers/load-homebrew.js' }),
      a.handler.custom({ dataSource: HOMEBREW_DATA_SOURCE, entry: './resolvers/tally-homebrew.js' }),
    ]),

  /** Returns the caller's profile, creating it (id = sub) the first time. */
  ensureProfile: a.mutation()
    .returns(a.ref('Profile').required())
    .authorization(allow => [allow.authenticated()])
    .handler([
      a.handler.custom({ dataSource: PROFILE_DATA_SOURCE, entry: './resolvers/load-profile.js' }),
      a.handler.custom({ dataSource: PROFILE_DATA_SOURCE, entry: './resolvers/ensure-profile.js' }),
    ]),
}

export const schema = a.schema(schemaEntries)

/** The client-side types of the schema (`generateClient<Schema>()`). */
export type Schema = ClientSchema<typeof schema>
