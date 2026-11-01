<script setup lang="ts">
/**
 * The Features tab (the live MeCsFeatures): class features by level, species traits,
 * the background, and every record picked through a choice (feats, ME edges and
 * reputation benefits), with chips to filter. Each opens its prose in place.
 */
import { speciesTraits, type Rec } from '@omnibrew/engine/rules'

const { t, te } = useI18n()
const { sheet } = useSheet()

interface Feature { key: string, collection: string, record: Rec, meta?: string }
interface Group { id: string, title: string, items: Feature[] }

const groups = computed<Group[]>(() => {
  const s = sheet.value
  const out: Group[] = []
  const classFeatures = s.classes.flatMap(k => k.features.map(f => ({ key: `cf-${f.id}`, collection: 'class-features', record: f, meta: `${k.subclassData && f.subclass ? k.subclassData.name : k.data.name} ${f.level}` })))
  if (classFeatures.length) out.push({ id: 'class', title: t('class_features_title'), items: classFeatures })
  const traits = speciesTraits(s).map(r => ({ key: `tr-${r.id}`, collection: 'traits', record: r }))
  if (traits.length) out.push({ id: 'species', title: t('traits_title'), items: traits })
  if (s.background) out.push({ id: 'background', title: t('background_title', 1), items: [{ key: `bg-${s.background.id}`, collection: 'backgrounds', record: s.background }] })

  // Records picked in choices (feats, edges...), grouped by collection.
  const unused = new Set(s.unusedChoices.map(c => c.path))
  const picked = new Map<string, Feature[]>()
  for (const c of s.character.choices) {
    if (unused.has(c.path)) continue
    const key = c.path.slice(c.path.lastIndexOf('/') + 1)
    for (const v of c.values) {
      if (typeof v !== 'string') continue
      const record = s.content.get(key, v)
      if (!record) continue
      const collection = s.content.has(key) ? key : (s.rules.families?.collection ?? key)
      picked.set(key, [...picked.get(key) ?? [], { key: `${key}-${v}-${c.path}`, collection, record }])
    }
  }
  for (const [key, items] of picked) out.push({ id: key, title: te(`sheet.features.groups.${key}`) ? t(`sheet.features.groups.${key}`) : key, items })
  return out
})

const filter = ref('all')
const shown = computed(() => groups.value.filter(g => filter.value === 'all' || g.id === filter.value))
const open = ref(new Set<string>())
const flip = (k: string) => {
  const next = new Set(open.value)
  if (next.has(k)) next.delete(k)
  else next.add(k)
  open.value = next
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="chip in [{ id: 'all', title: t('all_title') }, ...groups]"
        :key="chip.id"
        type="button"
        class="inline-flex h-7 items-center rounded-sm px-2 font-label text-[0.8125rem] font-semibold ring-1 transition-colors max-sm:h-9"
        :class="filter === chip.id ? 'bg-primary/10 text-primary ring-primary/55' : 'text-default ring-accented hover:bg-elevated'"
        :aria-pressed="filter === chip.id"
        @click="filter = chip.id"
      >
        {{ chip.title }}
      </button>
    </div>
    <section v-for="g in shown" :key="g.id" class="flex flex-col gap-1">
      <h3 class="section-tick font-label text-base font-semibold text-highlighted">
        {{ g.title }}
      </h3>
      <ul class="flex flex-col">
        <li v-for="f in g.items" :key="f.key" class="border-b border-default last:border-0">
          <button type="button" class="flex min-h-10 w-full items-center gap-2 py-1.5 text-start" :aria-expanded="open.has(f.key)" @click="flip(f.key)">
            <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-muted transition-transform" :class="{ 'rotate-90': open.has(f.key) }" />
            <span class="flex-1 text-sm font-semibold text-highlighted">{{ f.record.name }}</span>
            <span v-if="f.meta" class="text-xs text-muted">{{ f.meta }}</span>
          </button>
          <SheetProse v-if="open.has(f.key)" :id="f.record.id" :collection="f.collection" class="pb-3 ps-6 text-sm" />
        </li>
      </ul>
    </section>
    <p v-if="!groups.length" class="text-sm text-muted">
      {{ t('sheet.features.none') }}
    </p>
  </div>
</template>
