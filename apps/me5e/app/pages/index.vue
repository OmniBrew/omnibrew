<script setup lang="ts">
definePageMeta({ layout: 'bare' })
const { t, tm, rt } = useI18n()
useSeoMeta({ title: t('title'), description: t('meta.home') })

const { data: entries } = await useAsyncData('home:news', () =>
  queryCollection('changelog').select('path', 'stem', 'title', 'description', 'date', 'image').all(), { default: () => [] })
const news = computed(() => newestFirst(entries.value.filter(e => !isJoke(recordId(e))), e => e.stem).slice(0, 6))

// homepage.info and homepage.features are lists of { title, text, button? } messages.
type Block = { title: string, text: string, eyebrow?: string, button?: string }
const blocks = (key: string) => (tm(key) as unknown as Array<Record<string, unknown>>).map(b =>
  Object.fromEntries(Object.entries(b).map(([k, v]) => [k, rt(v as Parameters<typeof rt>[0])])) as Block)
const info = blocks('homepage.info')
const features = blocks('homepage.features')
const infoImages = [
  [{ src: '/images/misc/sys_alliance.png', alt: 'Systems Alliance symbol by Engorn on DeviantArt' }, { src: '/images/classes/vanguard.svg', alt: 'Vanguard symbol' }],
  [{ src: '/images/misc/assault_rifle.svg', alt: 'Assault rifle' }],
  [{ src: '/images/misc/reaper_avatar.jpg', alt: 'Reaper swarm' }],
]
// Image bands: the photo stays fixed behind the page on wide screens (parallax), never on phones or with reduced motion.
const band = 'bg-cover bg-center md:bg-fixed md:motion-reduce:bg-scroll'
const featureLinks = [
  { to: '/manual/intro', image: '/images/misc/datapad.png', alt: 'Data pad' },
  { to: '/assets', image: '/images/misc/tt_assets.png', alt: 'Assets preview' },
  { to: '/about', image: '/images/misc/grunts.png', alt: 'Swarm of people' },
]
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-citadel-900" :class="band" style="background-image: url('/images/parallax/citadel.jpg')">
      <!-- Scrim: the photo keeps its color at the top and fades into the page below. -->
      <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,color-mix(in_oklab,var(--ui-bg)_55%,transparent)_68%,var(--ui-bg)_100%)]" />
      <div class="relative mx-auto flex min-h-[30rem] max-w-2xl flex-col items-center justify-end px-4 pt-16 pb-12 text-center md:min-h-[36rem]">
        <img src="/images/me5e_logo_1200w.png" alt="Mass Effect 5e logo" class="mx-auto w-full max-w-[37.5rem]">
        <h1 class="sr-only">
          {{ t('title') }}
        </h1>
        <h2 class="mt-10 text-[1.3125rem]/7 font-bold text-highlighted sm:text-2xl/8">
          {{ t('homepage.title') }}
        </h2>
        <p class="mt-1 font-medium text-highlighted">
          {{ t('homepage.subtitle') }}
        </p>
        <UButton to="/manual/intro" color="brand" size="lg" trailing-icon="i-lucide-arrow-right" :label="t('homepage.get_started')" class="mt-5" />
      </div>
    </section>

    <UContainer class="py-14">
      <div class="mx-auto max-w-3xl text-center">
        <h2 class="text-[1.3125rem]/7 font-bold text-highlighted sm:text-2xl/8">
          {{ t('homepage.begin') }}
        </h2>
        <p class="mt-3 text-[0.9375rem]/[1.7]">
          {{ t('homepage.begin_text') }}
        </p>
      </div>
      <div class="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
        <div v-for="(block, i) in info" :key="block.title" class="rounded-md border border-default bg-muted p-5">
          <div class="flex items-center gap-2">
            <template v-for="(img, j) in infoImages[i]" :key="img.src">
              <span v-if="j" class="text-dimmed" aria-hidden="true">+</span>
              <img :src="img.src" :alt="img.alt" class="size-14 rounded-full object-contain" :class="i === 1 ? 'bg-primary p-2' : ''">
            </template>
          </div>
          <h3 class="mt-4 font-label text-base font-semibold text-highlighted">
            {{ block.title }}
          </h3>
          <p class="mt-2 text-sm/6 text-toned">
            {{ block.text }}
          </p>
        </div>
      </div>
    </UContainer>

    <section class="relative grid min-h-72 place-items-center bg-citadel-900 px-4" :class="band" style="background-image: url('/images/parallax/joker.jpg')">
      <div class="absolute inset-0 bg-citadel-950/42" />
      <h2 class="relative text-center text-[1.75rem]/9 font-bold text-white [text-shadow:0_2px_10px_rgb(0_0_0/0.6)] sm:text-4xl/11">
        {{ t('homepage.play_text') }}
      </h2>
    </section>

    <UContainer class="max-w-5xl space-y-14 py-16">
      <div v-for="(f, i) in features" :key="f.title" class="flex items-center gap-10" :class="i % 2 ? 'flex-row-reverse' : ''">
        <div class="flex-1">
          <p v-if="f.eyebrow" class="eyebrow text-primary">
            {{ f.eyebrow }}
          </p>
          <h3 class="mt-1 text-[1.1875rem]/[1.625rem] font-semibold text-highlighted">
            {{ f.title }}
          </h3>
          <p class="mt-2 text-[0.9375rem]/[1.7]">
            {{ f.text }}
          </p>
          <UButton :to="featureLinks[i]!.to" variant="link" trailing-icon="i-lucide-chevron-right" :label="f.button" class="mt-2 px-0" />
        </div>
        <img :src="featureLinks[i]!.image" :alt="featureLinks[i]!.alt" class="hidden size-48 object-contain md:block">
      </div>
    </UContainer>

    <section class="relative grid min-h-72 place-items-center bg-citadel-900 px-4" :class="band" style="background-image: url('/images/parallax/illusive.jpg')">
      <div class="absolute inset-0 bg-citadel-950/42" />
      <h2 class="relative text-center text-[1.75rem]/9 font-bold text-white [text-shadow:0_2px_10px_rgb(0_0_0/0.6)] sm:text-4xl/11">
        {{ t('homepage.news') }}
      </h2>
    </section>

    <UContainer class="max-w-5xl py-14">
      <div v-if="news.length" class="grid gap-4 md:grid-cols-12">
        <MeNewsCard :post="news[0]!" image-class="h-60 md:h-80" class="md:col-span-7" />
        <div class="grid gap-4 md:col-span-5">
          <MeNewsCard v-for="p in news.slice(1, 3)" :key="p.path" :post="p" image-class="h-32" />
        </div>
        <MeNewsCard v-for="p in news.slice(3, 6)" :key="p.path" :post="p" class="md:col-span-4" />
      </div>
    </UContainer>
  </div>
</template>
