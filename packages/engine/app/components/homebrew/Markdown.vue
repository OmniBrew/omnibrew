<script setup lang="ts">
/** Prose in markdown (plan/26 §1.3), with a preview through `<MDC>` as content renders it. Raw HTML never renders. */
import { escapeTags } from '../../utils/homebrew'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()
const tab = ref<'write' | 'preview'>('write')
</script>

<template>
  <div class="flex flex-col gap-2">
    <UTabs v-model="tab" size="xs" :items="[{ label: t('homebrew.markdown.write'), value: 'write' }, { label: t('homebrew.markdown.preview'), value: 'preview' }]" :content="false" class="w-56" />
    <UTextarea v-if="tab === 'write'" :model-value="props.modelValue" :rows="8" autoresize class="w-full font-mono text-sm" @update:model-value="v => emit('update:modelValue', String(v))" />
    <div v-else class="min-h-24 rounded-sm border border-default bg-default p-3">
      <MDC v-if="props.modelValue.trim()" :value="escapeTags(props.modelValue)" class="prose-record text-sm" />
      <p v-else class="text-sm text-muted">
        {{ t('homebrew.markdown.empty') }}
      </p>
    </div>
    <p class="text-xs text-muted">
      {{ t('homebrew.markdown.help') }}
    </p>
  </div>
</template>
