<script setup lang="ts">
/**
 * A class in the classes list, linking to its page: icon, name, homebrew
 * author, summary, and its hit die, primary abilities and saving throws.
 */
const props = defineProps<{
  klass: {
    path?: string
    name?: string
    snippet?: string
    author?: string
    hitDie?: number
    primaryAbility?: string[]
    profs?: { 'saving-throw'?: { has?: string[] } }
  }
  image: string
}>()

const { t } = useI18n()
const abilities = (ids: string[] = []) => ids.map(a => t(`abilities.${a}.title`))
const stats = computed(() => {
  const primary = abilities(props.klass.primaryAbility)
  const saves = abilities(props.klass.profs?.['saving-throw']?.has)
  return [
    [t('hit_dice_title'), t('dice', { dieCount: 1, dieType: props.klass.hitDie ?? 0 })],
    [t('primary_ability_title'), t(`lists.short_or_list[${primary.length}]`, primary)],
    [t('saves_title'), t(`lists.short_comma_list[${saves.length}]`, saves)],
  ]
})
</script>

<template>
  <NuxtLink
    :to="klass.path"
    class="group flex h-full gap-4 rounded-md border border-default bg-elevated/40 p-4 transition-colors hover:border-primary hover:bg-elevated sm:gap-6 sm:p-5"
  >
    <div class="flex w-16 shrink-0 flex-col items-center gap-2 sm:w-28">
      <img :src="image" alt="" class="size-16 sm:size-28">
      <p v-if="klass.author" class="text-center text-xs italic text-primary">
        by {{ klass.author }}
      </p>
    </div>
    <div class="min-w-0 flex-1">
      <h2 class="font-display text-2xl font-semibold text-highlighted group-hover:text-primary">
        {{ klass.name }}
      </h2>
      <p class="mt-1 text-sm text-muted">
        {{ klass.snippet }}
      </p>
      <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
        <template v-for="[label, value] in stats" :key="label">
          <dt class="font-semibold text-highlighted">
            {{ label }}
          </dt>
          <dd>{{ value }}</dd>
        </template>
      </dl>
    </div>
  </NuxtLink>
</template>
