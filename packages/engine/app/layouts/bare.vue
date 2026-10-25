<!-- Header and footer around a full-width page (the home page). -->
<template>
  <div>
    <SiteHeader />
    <UMain>
      <slot />
    </UMain>
    <SiteFooter />
    <SiteSearch />
  </div>
</template>
