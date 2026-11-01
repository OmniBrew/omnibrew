import type { Rules } from '@omnibrew/engine/rules'
import type { Game } from '@omnibrew/engine/schemas'
import { definition } from '#game-client'

export interface LoadedRules {
  game: Game
  rules: Rules
}

let loading: Promise<LoadedRules> | null = null
const prose = new Map<string, Promise<Record<string, string>>>()

const fileUrl = (name: string) => `${useRuntimeConfig().app.baseURL}_rules/${name}`

/**
 * The rules engine in the browser (plan/24 §1.2): the game definition (`#game-client`)
 * and the rules bundle, loaded once by the first character page. Reference pages never
 * load either.
 */
export function useRules(): Promise<LoadedRules> {
  if (loading) return loading
  const config = useRuntimeConfig().public.rules as { game: string, hash: string }
  loading = (async () => {
    if (!definition || !config?.hash) throw new Error('this site has no rules bundle')
    const def = definition
    const [{ createGame }, engine, bundle] = await Promise.all([
      import('@omnibrew/engine/schemas'),
      import('@omnibrew/engine/rules'),
      $fetch<import('@omnibrew/engine/rules').RulesBundle>(fileUrl(`${config.game}.${config.hash}.json`)),
    ])
    const game = createGame(def)
    return { game, rules: engine.createRules(game, engine.bundleRecords(bundle)) }
  })()
  loading.catch(() => {
    loading = null
  })
  return loading
}

/** One collection's prose (record id → markdown), fetched once when a card shows it. */
export function useProse(collection: string): Promise<Record<string, string>> {
  const config = useRuntimeConfig().public.rules as { game: string, hash: string, prose: string[] }
  if (!config?.prose?.includes(collection)) return Promise.resolve({})
  let file = prose.get(collection)
  if (!file) {
    file = $fetch<Record<string, string>>(fileUrl(`${config.game}.${config.hash}.prose.${collection}.json`))
    file.catch(() => prose.delete(collection))
    prose.set(collection, file)
  }
  return file
}
