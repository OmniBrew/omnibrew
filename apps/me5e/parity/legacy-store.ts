/* eslint-disable @typescript-eslint/no-explicit-any -- drives the untyped Vuex modules of the old site */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * The live site's character rules, run in Node: the Vuex modules under
 * `masseffect-5e/store/character/` (unchanged) behind a minimal store that
 * resolves getters lazily, plus the live content (`masseffect-5e-data/docs/v144/en`).
 *
 * Only the parity test uses this. It imports the old site's own files, so the
 * old repo and its `node_modules` must be checked out next to this one; the
 * `~/` alias inside them is resolved by `vitest.config.ts`.
 */
const MODULES = [
  'abilities', 'ac', 'companion', 'defenses', 'equipment', 'homebrew', 'hp', 'klasses', 'mechanics',
  'powers', 'primers', 'profs', 'reputation', 'resources', 'selections', 'skills', 'species',
] as const

interface VuexModule {
  state?: () => Record<string, any>
  getters?: Record<string, (...args: any[]) => any>
  mutations?: Record<string, (state: any, payload: any) => void>
  actions?: Record<string, (ctx: any, payload?: any) => any>
}

export interface LegacyPaths {
  /** Checkout of queryluke/masseffect-5e. */
  site: string
  /** Folder of the live content JSON (`masseffect-5e-data/docs/v144/en`). */
  data: string
}

export function legacyPaths(workspace: string): LegacyPaths {
  return { site: join(workspace, 'masseffect-5e'), data: join(workspace, 'masseffect-5e-data/docs/v144/en') }
}

export const legacyAvailable = (p: LegacyPaths) =>
  existsSync(join(p.site, 'store/character/index.js')) && existsSync(join(p.site, 'node_modules/lodash')) && existsSync(join(p.data, 'classes.json'))

/** Live content JSON by endpoint (`classes`, or an edge family such as `fighting-styles`). */
export interface LegacyData {
  get: (endpoint: string) => any[]
}

export function loadLegacyData(dir: string): LegacyData {
  const cache = new Map<string, any[]>()
  return {
    get(endpoint) {
      if (!cache.has(endpoint)) {
        const file = join(dir, `${endpoint}.json`)
        // store/index.js baseData: an endpoint without a file is an edge family.
        const edges = () => (JSON.parse(readFileSync(join(dir, 'edges.json'), 'utf8')) as any[]).filter(i => i.type === endpoint)
        cache.set(endpoint, existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : edges())
      }
      return cache.get(endpoint)!
    },
  }
}

/** A Vuex store reduced to what the character modules use: namespaced getters, commits and dispatches. */
export class LegacyStore {
  readonly state: Record<string, any> = {}
  private readonly modules = new Map<string, VuexModule>()
  private readonly cache = new Map<string, any>()
  readonly getters: Record<string, any>

  constructor(modules: Record<string, VuexModule>, private readonly data: LegacyData) {
    const character: Record<string, any> = { ...modules.character!.state?.() }
    for (const [ns, mod] of Object.entries(modules)) {
      this.modules.set(ns, mod)
      if (ns !== 'character') character[ns.split('/')[1]!] = mod.state?.() ?? {}
    }
    this.state.character = character
    this.state.cbVersion = '1.0.2'
    this.getters = new Proxy({}, { get: (_, name) => this.get(String(name)) })
  }

  private localState(ns: string) {
    return ns === 'character' ? this.state.character : this.state.character[ns.split('/')[1]!]
  }

  private localGetters(ns: string) {
    return new Proxy({}, { get: (_, name) => this.get(`${ns}/${String(name)}`) })
  }

  private rootGetter(name: string): any {
    switch (name) {
      case 'getData': return (endpoint: string) => (['powers', 'weapons'].includes(endpoint) ? [...this.data.get(endpoint)] : this.data.get(endpoint))
      case 'getItem': return (endpoint: string, id: string) => this.data.get(endpoint).find(d => d.id === id)
      case 'homebrew': return []
      case 'auth/isAuthenticated': return false
      default: throw new Error(`legacy store: no root getter "${name}"`)
    }
  }

  get(name: string): any {
    if (this.cache.has(name)) return this.cache.get(name)
    const slash = name.lastIndexOf('/')
    let value
    if (slash < 0 || !name.startsWith('character')) {
      value = this.rootGetter(name)
    }
    else {
      const ns = name.slice(0, slash)
      const fn = this.modules.get(ns)?.getters?.[name.slice(slash + 1)]
      if (!fn) throw new Error(`legacy store: no getter "${name}"`)
      value = fn(this.localState(ns), this.localGetters(ns), this.state, this.getters)
    }
    this.cache.set(name, value)
    return value
  }

  commit(ns: string, type: string, payload: unknown) {
    const fn = this.modules.get(ns)?.mutations?.[type]
    if (!fn) throw new Error(`legacy store: no mutation "${ns}/${type}"`)
    fn(this.localState(ns), payload)
    this.cache.clear()
  }

  dispatch(ns: string, type: string, payload?: unknown): any {
    const fn = this.modules.get(ns)?.actions?.[type]
    if (!fn) throw new Error(`legacy store: no action "${ns}/${type}"`)
    return fn({
      state: this.localState(ns),
      getters: this.localGetters(ns),
      rootState: this.state,
      rootGetters: this.getters,
      commit: (t: string, p: unknown, opts?: { root?: boolean }) => {
        if (opts?.root) {
          const i = t.lastIndexOf('/')
          return this.commit(t.slice(0, i), t.slice(i + 1), p)
        }
        return this.commit(ns, t, p)
      },
      dispatch: (t: string, p: unknown, opts?: { root?: boolean }) => {
        const full = opts?.root ? t : `${ns}/${t}`
        const i = full.lastIndexOf('/')
        return this.dispatch(full.slice(0, i), full.slice(i + 1), p)
      },
    }, payload)
  }

  /** Loads a (current-version) character and builds its mechanics, as LOAD_CHARACTER does. */
  load(character: Record<string, any>) {
    this.commit('character', 'SET_CHARACTER', character)
    this.dispatch('character/mechanics', 'INIT_MECHANICS')
  }
}

const imported = new Map<string, Record<string, VuexModule>>()

async function importModules(site: string) {
  if (imported.has(site)) return imported.get(site)!
  const load = (file: string) => import(pathToFileURL(join(site, file)).href) as Promise<VuexModule>
  const modules: Record<string, VuexModule> = { character: await load('store/character/index.js') }
  for (const m of MODULES) modules[`character/${m}`] = await load(`store/character/${m}.js`)
  modules['character/migrator'] = await load('store/character/migrator.js')
  imported.set(site, modules)
  return modules
}

export async function createLegacyStore(paths: LegacyPaths, data = loadLegacyData(paths.data)) {
  return new LegacyStore(await importModules(paths.site), data)
}

/** The old site's mixins (csActions computes hit, DC, damage text and `{{ }}` placeholders for every action card). */
export async function importLegacyMixins(site: string) {
  const csActions = await import(pathToFileURL(join(site, 'mixins/character/csActions.js')).href)
  return { CsActions: csActions.CsActions as Record<string, any> }
}
