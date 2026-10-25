/**
 * The route's path without a trailing slash. Static hosts serve `<path>/index.html`
 * by redirecting `<path>` to `<path>/`, while content paths, prerendered payload
 * keys and canonical links have none.
 */
export function useContentPath() {
  const route = useRoute()
  return computed(() => (route.path.length > 1 ? route.path.replace(/\/+$/, '') : route.path))
}
