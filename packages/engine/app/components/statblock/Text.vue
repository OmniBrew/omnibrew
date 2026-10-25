<script setup lang="ts">
/**
 * Inline stat-block text (an entry's text, or a worked-out attack): MDC with
 * emphasis and prose components (`:distance{length="10"}`), rendered directly
 * so a list's rows don't each run the markdown parser. Other markdown goes
 * through <MDC>.
 */
const props = defineProps<{ value: string }>()

const { vueApp } = useNuxtApp()
const tokens = computed(() => inlineTokens(props.value))
const pascal = (name: string) => name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
// Prose components are registered globally (see the engine's nuxt.config).
const prose = (name: string) => vueApp.component(pascal(name))
</script>

<template>
  <MDC v-if="!tokens" :value="value" tag="span" unwrap="p" />
  <span v-else><template v-for="(token, i) in tokens" :key="i"><em v-if="token.type === 'em'">{{ token.value }}</em><strong v-else-if="token.type === 'strong'">{{ token.value }}</strong><component :is="prose(token.name)" v-else-if="token.type === 'component' && prose(token.name)" v-bind="token.props" /><template v-else-if="token.type === 'text'">{{ token.value }}</template></template></span>
</template>
