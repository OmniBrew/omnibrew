<script setup lang="ts">
/**
 * A power's casting summary: level, casting time, duration, range, attack and
 * effect, from its first casting entry. The default slot adds the game's own
 * stats (ME5e: primes/detonates) as more `<StatItem>`s.
 */
import type { Casting } from '../../utils/powers'

const props = defineProps<{
  power: { level?: number, tags?: string[], casting?: unknown[] }
}>()

const { t } = useI18n()
const casting = computed(() => (props.power.casting?.[0] ?? {}) as Casting)
const reaction = computed(() => reactionNote(casting.value))
</script>

<template>
  <div>
    <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-default bg-(--ui-border) md:grid-cols-4 *:bg-muted *:px-4 *:py-3">
      <StatItem :label="t('level_title', 1)">
        {{ powerLevel(t, power.level ?? 0) }}
      </StatItem>
      <StatItem :label="t('casting_time_title')">
        {{ castingTimeText(t, casting) }}
      </StatItem>
      <StatItem :label="t('duration_title')">
        <PowerDuration :casting="casting" />
      </StatItem>
      <StatItem :label="t('range_area_title')">
        <PowerRange :casting="casting" />
      </StatItem>
      <slot :casting="casting" />
      <StatItem :label="t('attack_type_title')">
        {{ attackText(t, casting) }}
      </StatItem>
      <StatItem :label="t('damage_effect_title')">
        {{ effectText(t, power.tags) }}
      </StatItem>
    </dl>
    <p v-if="reaction" class="mt-3 text-sm italic text-muted">
      * <MDC :value="reaction" tag="span" unwrap="p" />
    </p>
  </div>
</template>
