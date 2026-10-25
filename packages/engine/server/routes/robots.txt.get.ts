import { defineEventHandler, setHeader, useRuntimeConfig } from '#imports'

// robots.txt, prerendered. A preview build (NUXT_PUBLIC_INDEXABLE=false) asks crawlers to stay away.
export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  const { public: { indexable } } = useRuntimeConfig(event)
  return `User-agent: *\n${indexable ? 'Allow: /' : 'Disallow: /'}\n`
})
