<!-- Header, sidebar navigation (wide screens; the header menu on narrow ones), page, footer. -->
<template>
  <div>
    <SiteHeader />
    <UMain>
      <UContainer>
        <UPage>
          <template #left>
            <UPageAside>
              <SiteNavigation />
            </UPageAside>
          </template>
          <slot />
        </UPage>
      </UContainer>
    </UMain>
    <SiteFooter />
    <SiteSearch />
  </div>
</template>
