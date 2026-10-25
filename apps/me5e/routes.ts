/**
 * Where each collection's records are on the site: the live site's URLs
 * (masseffect-5e/pages). Read by app.config.ts (links, search) and
 * nuxt.config.ts (prerendering). See the engine's `recordPath`.
 */
export const recordRoutes: Record<string, string | false> = {
  'conditions': '/appendix/conditions/{id}',
  'tool-profs': '/appendix/tool-profs/{id}',
  'skills': '/appendix/skills#{id}',
  'weapon-properties': '/appendix/weapon-properties#{id}',
  'manual': '/manual/{chapter}#{id}',
  'guide': '/guide/{chapter}#{id}',
  'class-features': '/classes/{klass}#{id}',
  'subclasses': '/classes/{klass}#{id}',
  'traits': '/species/{species.0}#{id}',
  'vehicles': '/vehicles#{id}',
  'edges': false,
  'actions': false,
  'set-bonuses': false,
  'subspecies': false,
  'attributions': false,
  'character-progression': false,
  'npc-stats': false,
  'ship-upgrades': false,
}
