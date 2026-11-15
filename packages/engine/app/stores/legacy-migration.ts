import type { MigrationStep } from '@omnibrew/engine/data'

/**
 * Moving a user's data from the game's older backend on their first sign-in (plan/28 §1),
 * for a game with `game.legacyMigration` on. Runs once per account: the profile's
 * `migratedAt` says it's done, and this browser remembers that, so later page loads cost
 * no request. The old profile picture is copied by the browser into the user's own
 * storage folder (resized as the profile page does).
 */
/** `useState` key bumped when a migration finishes (`plugins/profile-preferences.client.ts`, `/profile` watch it). */
export const LEGACY_MIGRATION_FINISHED = 'legacy-migration:finished'

export const useLegacyMigration = defineStore('legacy-migration', () => {
  const session = useSession()
  const status = ref<'idle' | 'running' | 'done' | 'error'>('idle')
  const report = ref<Record<string, unknown> | null>(null)
  /** Bumped when a migration finishes: the profile and its preferences may have changed. A `useState` key, so watchers needn't load this store. */
  const finished = useState<number>(LEGACY_MIGRATION_FINISHED, () => 0)
  let running: Promise<void> | null = null
  // Taken while the store is created (inside the Nuxt context); `run` continues after awaits, where it's gone.
  const nuxtApp = useNuxtApp()
  const appConfig = useAppConfig()
  const toast = useToast()

  const flagKey = (sub: string) => `omnibrew:${nuxtApp.$characterGame.id}:migrated:${sub}`
  function flag(sub: string, value?: string) {
    try {
      if (value) localStorage.setItem(flagKey(sub), value)
      return localStorage.getItem(flagKey(sub))
    }
    catch {
      return null
    }
  }

  async function copyPicture(url: string, data: { profile: { update: (patch: { profileImg: string }) => Promise<unknown> } }) {
    const { resizePicture, uploadPicture } = useProfilePicture()
    const response = await fetch(url)
    if (!response.ok) return
    const path = await uploadPicture(await resizePicture(await response.blob()))
    await data.profile.update({ profileImg: path })
  }

  /** Brings the signed-in user's old data across, unless that already happened. */
  function run(): Promise<void> {
    running ??= (async () => {
      const sub = session.user?.sub
      if (!appConfig.game.legacyMigration || !sub || flag(sub)) return
      const data = await nuxtApp.runWithContext(() => useUserData())
      if (!data) return
      const t = nuxtApp.$i18n.t
      try {
        const profile = await data.profile.mine()
        if (profile.migratedAt) {
          flag(sub, profile.migratedAt)
          return
        }
        status.value = 'running'
        // Shown only if the first step takes a moment (a skipped or empty account answers at once).
        let notice: { id: string | number } | null = null
        const slow = setTimeout(() => (notice = toast.add({ title: t('migration.running'), icon: 'i-lucide-loader-circle', duration: 0 })), 800)
        let step: MigrationStep | null = null
        let picture: string | null = null
        try {
          // Each call handles what fits in AppSync's time limit; a large account takes a few.
          for (let i = 0; i < 30 && !step?.done; i++) {
            step = await data.legacy.migrate()
            picture ??= step.pictureUrl
          }
        }
        finally {
          clearTimeout(slow)
          if (notice) toast.remove((notice as { id: string | number }).id)
        }
        if (!step?.done) throw new Error('not finished')
        // The backend isn't migrating this account yet (before cutover): ask again on a later visit.
        if (!step.report) {
          status.value = 'idle'
          return
        }
        // A picture that can't be copied isn't worth failing the rest for; the profile page can take a new one.
        if (picture) await copyPicture(picture, data).catch(e => console.warn('The old profile picture could not be copied', e))
        report.value = step.report
        flag(sub, new Date().toISOString())
        status.value = 'done'
        finished.value++
        const r = migrationCounts(step.report)
        if (r.total || r.failed) {
          toast.add({
            title: t('migration.done_title'),
            description: t('migration.done', r),
            color: r.failed ? 'warning' : 'success',
            icon: 'i-lucide-package-check',
            duration: 15000,
            actions: [{ label: t('migration.details'), to: '/profile#migration' }],
          })
        }
      }
      catch {
        status.value = 'error'
        toast.add({ title: t('migration.failed'), color: 'error', icon: 'i-lucide-triangle-alert', duration: 15000 })
      }
    })().finally(() => {
      running = null
    })
    return running
  }

  return { status, report, finished, run }
})

/** Counts for the summary toast, from a migration report (plan/28 §1.2). */
export function migrationCounts(report: Record<string, unknown> | null | undefined) {
  const n = (path: string[]) => {
    let cur: unknown = report
    for (const k of path) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[k] : undefined
    return Array.isArray(cur) ? cur.length : typeof cur === 'number' ? cur : 0
  }
  const characters = n(['characters', 'migrated'])
  const bookmarks = n(['bookmarks', 'migrated'])
  const homebrew = n(['homebrew', 'claimed']) + n(['homebrew', 'converted'])
  const failed = n(['characters', 'failed'])
  return { characters, bookmarks, homebrew, failed, total: characters + bookmarks + homebrew }
}
