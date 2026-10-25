/**
 * `queryCollection` for a collection named at run time. Engine components get
 * collection names from props or the game's config, so they can't use the
 * app's typed collection names; records come back as plain objects.
 */
export type LooseRecord = Record<string, unknown> & { stem: string, path?: string, title?: string, name?: string, body?: unknown }

export interface LooseQuery {
  where: (field: string, operator: string, value?: unknown) => LooseQuery
  order: (field: string, direction: 'ASC' | 'DESC') => LooseQuery
  select: (...fields: string[]) => LooseQuery
  path: (path: string) => LooseQuery
  all: () => Promise<LooseRecord[]>
  first: () => Promise<LooseRecord | null>
}

export const queryRecords = (collection: string) => queryCollection(collection as never) as unknown as LooseQuery
