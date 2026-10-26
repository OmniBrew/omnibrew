<script setup lang="ts">
const route = useRoute()
const path = useContentPath().value
const { t, te } = useI18n()

const { data: klass } = await useAsyncData(path, () => queryCollection('classes').path(path).first())
if (!klass.value) throw createError({ statusCode: 404, statusMessage: 'Class not found', fatal: true })
const id = recordId(klass.value)

const [{ data: features }, { data: subclasses }, { data: levels }, { data: powers }] = await Promise.all([
  useAsyncData(`${path}:features`, () => queryCollection('classFeatures').where('klass', '=', id).all(), { default: () => [] }),
  useAsyncData(`${path}:subclasses`, () => queryCollection('subclasses').where('klass', '=', id).order('name', 'ASC').all(), { default: () => [] }),
  useAsyncData('character-progression', () => queryCollection('characterProgression').order('level', 'ASC').all(), { default: () => [] }),
  useAsyncData(`${path}:powers`, () => queryCollection('powers').where('classes', 'LIKE', `%"${id}"%`).order('level', 'ASC').order('name', 'ASC').all(), { default: () => [] }),
])

useSeoMeta({ title: klass.value.name, description: t('meta.class_info', { name: klass.value.name }) })

const progression = computed(() => klass.value?.progression ?? { subclass: [], abi: [] })
// The Features column's name on subclass levels; a class may have its own.
const subclassLabel = computed(() => t(te(`subclass_feature_titles.${id}`) ? `subclass_feature_titles.${id}` : 'subclass_feature_titles.default'))

const tabs = [
  { label: t('progression_table_title'), value: 'table', slot: 'table' as const },
  { label: t('class_features_title'), value: 'features', slot: 'features' as const },
  { label: t('subclass_title', 2), value: 'subclasses', slot: 'subclasses' as const },
  { label: t('power_title', 2), value: 'powers', slot: 'powers' as const },
]
const tab = ref('table')

// Search links to `/classes/<class>#<feature or subclass>`: open the tab that holds it, then scroll
// to it. The tab's panel shows a task later; by then the router has scrolled to it while hidden.
async function showHash(hash: string) {
  const target = classHashTab(hash, features.value, subclasses.value)
  if (!target) return
  tab.value = target
  await nextTick()
  await new Promise(resolve => setTimeout(resolve))
  document.getElementById(classHashId(hash))?.scrollIntoView()
}
onMounted(() => showHash(route.hash))
watch(() => route.hash, showHash)
</script>

<template>
  <MeClassTheme v-if="klass" :klass="id">
    <UPage>
      <RecordHeader
        :title="klass.name ?? ''"
        :headline="t('class_title', 1)"
        headline-class="text-(--klass-accent)"
        :image="`/images/classes/${id}.svg`"
        :author="klass.author"
        :links="[{ label: t('class_title', 2), icon: 'i-lucide-arrow-left', to: '/classes', variant: 'ghost' }]"
      />
      <UPageBody>
        <ContentRenderer :value="klass" class="max-w-3xl" />
        <UTabs
          v-model="tab"
          :items="tabs"
          variant="link"
          :unmount-on-hide="false"
          :ui="{
            list: '[--ui-primary:var(--klass-accent)]',
            trigger: 'flex-1 px-1 sm:flex-none sm:px-3',
            label: 'whitespace-normal text-center',
            content: 'pt-6',
          }"
        >
          <template #table>
            <MeClassTable
              :progression="progression"
              :levels="levels"
              :features="features"
              :subclasses="subclasses"
              :klass="id"
              :subclass-label="subclassLabel"
            />
          </template>
          <template #features>
            <KlassAttributes :klass="klass" />
            <KlassFeatureList :features="features" :abi="progression.abi" :klass="id" />
          </template>
          <template #subclasses>
            <KlassSubclasses :subclasses="subclasses" :features="features" flavor filter />
          </template>
          <template #powers>
            <MeClassPowers :powers="powers" />
          </template>
        </UTabs>
      </UPageBody>
    </UPage>
  </MeClassTheme>
</template>
