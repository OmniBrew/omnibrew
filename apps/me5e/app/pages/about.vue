<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('about_title'), description: t('meta.about') })

const [{ data: about }, { data: attributions }] = await Promise.all([
  useAsyncData('about', () => queryCollection('about').first()),
  useAsyncData('attributions', () => queryCollection('attributions').order('title', 'ASC').all(), { default: () => [] }),
])

const roles = (r?: string | string[]) => [r ?? []].flat().map(role => t(`aboutpage.roles.${role}`)).join(', ')
const communities = [
  { name: 'Discord', image: '/images/misc/discord.svg', link: 'https://discord.gg/c2UnqkH' },
  { name: 'Reddit', image: '/images/misc/Reddit_Lockup_OnDark.svg', link: 'https://www.reddit.com/r/masseffect5e/' },
]
</script>

<template>
  <UPage>
    <UPageBody>
      <img src="/images/me5e_logo_1200w.png" alt="Mass Effect 5e logo" class="mx-auto mt-6 w-full max-w-lg">
      <h1 class="sr-only">
        {{ t('about_title') }}
      </h1>

      <h2 class="mt-12 text-center font-display text-3xl font-bold text-highlighted">
        {{ t('buttons.join_community') }}
      </h2>
      <div class="mt-6 flex flex-wrap justify-center gap-6">
        <a v-for="c in communities" :key="c.name" :href="c.link" target="_blank" rel="noopener" class="flex h-28 w-64 items-center justify-center rounded-md bg-neutral-900 p-6 transition hover:ring-2 hover:ring-primary">
          <img :src="c.image" :alt="`${c.name} logo`" class="max-h-16">
        </a>
      </div>

      <div class="mx-auto mt-14 max-w-3xl text-center">
        <h2 class="font-display text-3xl font-bold text-highlighted">
          {{ t('aboutpage.about_me5e_title') }}
        </h2>
        <p class="mt-3">
          {{ t('aboutpage.about_text') }}
        </p>
      </div>

      <h2 class="mt-12 font-display text-2xl font-bold text-highlighted">
        {{ t('aboutpage.current_title') }}
      </h2>
      <div class="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
        <div v-for="p in about?.current" :key="p.name" class="text-center">
          <img :src="p.image" :alt="p.name" class="mx-auto size-24 rounded-full bg-muted object-cover">
          <p class="mt-2 font-display text-lg font-semibold text-highlighted">
            {{ p.name }}
          </p>
        </div>
      </div>

      <UAlert
        color="error"
        variant="outline"
        icon="i-lucide-bug"
        :title="t('aboutpage.bug_title')"
        class="mx-auto mt-10 max-w-2xl"
      >
        <template #description>
          <i18n-t keypath="aboutpage.bug_report" tag="span">
            <template #channel>
              <code>#typos-and-errors</code>
            </template>
            <template #discord>
              <a href="https://discord.gg/c2UnqkH" target="_blank" rel="noopener" class="underline">Discord</a>
            </template>
          </i18n-t>
        </template>
      </UAlert>

      <h2 class="mt-12 font-display text-2xl font-bold text-highlighted">
        {{ t('aboutpage.former_contributors_title') }}
      </h2>
      <div class="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-6">
        <div v-for="p in about?.former" :key="p.name" class="text-center">
          <img :src="p.image" :alt="p.name" class="mx-auto size-20 rounded-full bg-muted object-cover grayscale">
          <p class="mt-2 text-sm font-semibold text-highlighted">
            {{ p.name }}
          </p>
          <p class="text-xs text-muted">
            {{ roles(p.roles) }}
          </p>
        </div>
      </div>

      <h2 class="mt-12 font-display text-2xl font-bold text-highlighted">
        {{ t('aboutpage.shoutouts_title') }}
      </h2>
      <p class="mt-2">
        {{ t('aboutpage.shoutouts_text') }}
      </p>
      <UAlert color="info" variant="subtle" class="mt-4">
        <template #description>
          <div class="flex flex-wrap items-center gap-4">
            <i18n-t keypath="aboutpage.races_shoutout" tag="p" class="flex-1">
              <template #races>
                <em>Races of the Relay</em>
              </template>
            </i18n-t>
            <UButton href="https://www.gmbinder.com/share/-L7HA1pIhxcx3bVb8vqf" target="_blank" label="Races of the Relay" color="info" />
          </div>
        </template>
      </UAlert>
      <p class="mt-4">
        {{ about?.shoutouts?.join(', ') }}, {{ t('aboutpage.all_others') }}
      </p>

      <h2 class="mt-12 font-display text-3xl font-bold text-highlighted">
        {{ t('aboutpage.image_attributions_title') }}
      </h2>
      <p class="mt-2">
        {{ t('aboutpage.image_attributions_text') }}
        <a href="https://masseffect.fandom.com/wiki/Mass_Effect_Wiki" target="_blank" rel="noopener" class="text-primary">
          <UIcon name="i-lucide-external-link" class="size-4 align-[-2px]" />
        </a>
      </p>
      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <a v-for="a in attributions" :key="a.attribution" :href="a.source" target="_blank" rel="noopener" class="overflow-hidden rounded-md border border-default transition hover:border-primary">
          <img :src="a.path" :alt="a.title" loading="lazy" class="h-48 w-full bg-citadel-200 object-contain">
          <p class="p-3 text-sm">{{ a.attribution }}</p>
        </a>
      </div>
    </UPageBody>
  </UPage>
</template>
