<script setup lang="ts">
definePageMeta({ layout: 'bare' })
const { t, tm, rt } = useI18n()
useSeoMeta({ title: t('title'), description: t('meta.home') })

const { data: entries } = await useAsyncData('home:news', () =>
  queryCollection('changelog').select('path', 'stem', 'title', 'description', 'date', 'image').all(), { default: () => [] })
const news = computed(() => newestFirst(entries.value.filter(e => !isJoke(recordId(e))), e => e.stem).slice(0, 6))

// homepage.info and homepage.features are lists of { title, text, button? } messages.
type Block = { title: string, text: string, button?: string }
const blocks = (key: string) => (tm(key) as unknown as Array<Record<string, unknown>>).map(b =>
  Object.fromEntries(Object.entries(b).map(([k, v]) => [k, rt(v as Parameters<typeof rt>[0])])) as Block)
const info = blocks('homepage.info')
const features = blocks('homepage.features')
const infoImages = [
  [{ src: '/images/misc/sys_alliance.png', alt: 'Systems Alliance symbol by Engorn on DeviantArt' }, { src: '/images/classes/vanguard.svg', alt: 'Vanguard symbol' }],
  [{ src: '/images/misc/assault_rifle.svg', alt: 'Assault rifle' }],
  [{ src: '/images/misc/reaper_avatar.jpg', alt: 'Reaper swarm' }],
]
const featureLinks = [
  { to: '/manual/intro', image: '/images/misc/datapad.png', alt: 'Data pad' },
  { to: '/assets', image: '/images/misc/tt_assets.png', alt: 'Assets preview' },
  { to: '/about', image: '/images/misc/grunts.png', alt: 'Swarm of people' },
]
</script>

<template>
  <div>
    <section class="relative flex min-h-[32rem] items-center justify-center bg-cover bg-center px-4 py-16" style="background-image: url('/images/parallax/citadel.jpg')">
      <div class="absolute inset-0 bg-white/20" />
      <div class="relative max-w-2xl text-center text-black">
        <img src="/images/me5e_logo_1200w.png" alt="Mass Effect 5e logo" class="mx-auto w-full max-w-xl">
        <h1 class="sr-only">
          {{ t('title') }}
        </h1>
        <h2 class="mt-10 font-display text-2xl font-bold">
          {{ t('homepage.title') }}
        </h2>
        <p class="font-medium">
          {{ t('homepage.subtitle') }}
        </p>
        <UButton to="/manual/intro" color="secondary" size="xl" :label="t('homepage.get_started')" class="mt-4" />
      </div>
    </section>

    <UContainer class="py-14">
      <div class="mx-auto max-w-3xl text-center">
        <h2 class="font-display text-2xl font-bold text-highlighted">
          {{ t('homepage.begin') }}
        </h2>
        <p class="mt-3">
          {{ t('homepage.begin_text') }}
        </p>
      </div>
      <div class="mt-12 grid gap-10 md:grid-cols-3">
        <div v-for="(block, i) in info" :key="block.title" class="text-center">
          <div class="flex items-center justify-center gap-3">
            <template v-for="(img, j) in infoImages[i]" :key="img.src">
              <span v-if="j" class="font-display text-xl">+</span>
              <img :src="img.src" :alt="img.alt" class="size-16 rounded-full object-contain" :class="i === 1 ? 'bg-primary p-2' : ''">
            </template>
          </div>
          <h3 class="mt-4 font-display text-xl font-semibold text-highlighted">
            {{ block.title }}
          </h3>
          <p class="mt-2 text-sm text-left">
            {{ block.text }}
          </p>
        </div>
      </div>
    </UContainer>

    <section class="flex min-h-72 items-center justify-center bg-cover bg-center px-4" style="background-image: url('/images/parallax/joker.jpg')">
      <h2 class="text-center font-display text-4xl font-bold text-white [text-shadow:0_2px_8px_rgb(0_0_0/0.8)]">
        {{ t('homepage.play_text') }}
      </h2>
    </section>

    <UContainer class="space-y-12 py-14">
      <div v-for="(f, i) in features" :key="f.title" class="flex items-center gap-8" :class="i % 2 ? 'flex-row-reverse' : ''">
        <div class="flex-1">
          <h3 class="font-display text-2xl font-bold text-highlighted">
            {{ f.title }}
          </h3>
          <p class="mt-2">
            {{ f.text }}
          </p>
          <UButton :to="featureLinks[i]!.to" variant="ghost" trailing-icon="i-lucide-chevron-right" :label="f.button" class="mt-2 -ms-2.5" />
        </div>
        <img :src="featureLinks[i]!.image" :alt="featureLinks[i]!.alt" class="hidden size-72 object-contain md:block">
      </div>
    </UContainer>

    <section class="flex min-h-72 items-center justify-center bg-cover bg-center px-4" style="background-image: url('/images/parallax/illusive.jpg')">
      <h2 class="text-center font-display text-4xl font-bold text-white [text-shadow:0_2px_8px_rgb(0_0_0/0.8)]">
        {{ t('homepage.news') }}
      </h2>
    </section>

    <UContainer class="py-14">
      <div v-if="news.length" class="grid gap-6 md:grid-cols-12">
        <MeNewsCard :post="news[0]!" image-class="h-72 md:h-[26rem]" class="md:col-span-7" />
        <div class="grid gap-6 md:col-span-5">
          <MeNewsCard v-for="p in news.slice(1, 3)" :key="p.path" :post="p" image-class="h-36" />
        </div>
        <MeNewsCard v-for="p in news.slice(3, 6)" :key="p.path" :post="p" class="md:col-span-4" />
      </div>
    </UContainer>
  </div>
</template>
