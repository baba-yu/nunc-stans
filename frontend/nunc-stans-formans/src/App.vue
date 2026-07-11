<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { Badge, SHELL_NAV, SideNav } from 'nunc-ui'
import { useMeStore } from './stores/me'

const store = useMeStore()

// The shell owns the engine-status chip; views load what they need.
onMounted(() => store.load())
</script>

<template>
  <div class="shell">
    <SideNav>
      <template #nav>
        <template v-for="l in SHELL_NAV" :key="l.href">
          <RouterLink
            v-if="l.spa"
            :to="l.href"
            class="nui-sidenav__link"
            :exact-active-class="l.href === '/' ? 'nui-sidenav__link--active' : ''"
            :active-class="l.href === '/' ? '' : 'nui-sidenav__link--active'"
          >
            {{ l.label }}
          </RouterLink>
          <a v-else :href="l.href" class="nui-sidenav__link">{{ l.label }}</a>
        </template>
      </template>
      <template #meta>
        <Badge :variant="store.reachable ? 'success' : 'error'">
          {{ store.reachable ? 'engine ok' : 'engine unreachable' }}
        </Badge>
      </template>
    </SideNav>
    <div class="content">
      <RouterView />
    </div>
  </div>
</template>
