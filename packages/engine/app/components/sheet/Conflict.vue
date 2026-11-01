<script setup lang="ts">
/** A save that lost to another tab or device (plan/24 §1.6): load the newer version, or keep this one over it. */
const { t } = useI18n()
const store = useCharacterStore()
const busy = ref(false)

async function resolve(choice: 'theirs' | 'mine') {
  busy.value = true
  try {
    await store.resolveConflict(choice)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UAlert
    v-if="store.saveState === 'conflict'"
    color="warning"
    variant="subtle"
    icon="i-lucide-git-compare"
    :title="t('sheet.conflict.title')"
    :description="t('sheet.conflict.text')"
    :actions="[
      { label: t('sheet.conflict.theirs'), variant: 'solid', color: 'warning', loading: busy, onClick: () => resolve('theirs') },
      { label: t('sheet.conflict.mine'), variant: 'outline', color: 'warning', loading: busy, onClick: () => resolve('mine') },
    ]"
    class="mb-3"
  />
</template>
