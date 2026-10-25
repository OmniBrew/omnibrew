/**
 * Site configuration a game app provides in its app.config.ts (`game.*`).
 * Labels are i18n keys from the content repo's messages/<locale>.yml.
 */

export interface NavItem {
  /** i18n key. */
  label: string
  /** Plural count for the label (`t(label, count)`). */
  count?: number
  to?: string
  icon?: string
  children?: NavItem[]
  /**
   * Children are the chapters of a navigation file (`manual` →
   * content/navigation/manual.yml), linked at `<to>/<chapter id>`.
   */
  chapters?: string
  /** A section heading: a label with its own items under it. */
  heading?: boolean
}

export interface SearchGroup {
  id: string
  /** i18n key, singular/plural (`character_title`). */
  label: string
  icon: string
  /** Collections whose records belong to this group (`class-features`). */
  collections: string[]
}

/** A chapter of a navigation file (content/navigation/<name>.yml); `title` is an i18n key. */
export interface Chapter {
  id: string
  title?: string
  is_new?: boolean
  is_change?: boolean
  sections?: Chapter[]
}

/** A record in the site search index (server/routes/search-index.json.get.ts). */
export interface SearchDoc {
  /** `<collection>/<id>`. */
  id: string
  title: string
  group: string
  collection: string
  /** The record a feature or trait belongs to (its class or species). */
  parent?: string
  to?: string
  text: string
}
