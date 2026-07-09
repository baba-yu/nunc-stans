<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { Badge } from 'nunc-ui'
import { useMeStore } from './stores/me'

const store = useMeStore()

// The shell owns the engine-status chip; views load what they need.
onMounted(() => store.load())
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">Nunc Stans</div>
      <nav class="tabs">
        <RouterLink to="/" class="tab" exact-active-class="tab--active">ME</RouterLink>
        <RouterLink to="/world" class="tab" active-class="tab--active">World</RouterLink>
        <RouterLink to="/timeline" class="tab" active-class="tab--active">Timeline</RouterLink>
        <RouterLink to="/profiles" class="tab" active-class="tab--active">Profiles</RouterLink>
        <RouterLink to="/runs" class="tab" active-class="tab--active">Runs</RouterLink>
        <a href="/fourfive/" class="tab">FourFive</a>
        <a href="/apps/" class="tab">Apps</a>
      </nav>
      <div class="topbar-meta">
        <Badge :variant="store.reachable ? 'success' : 'error'">
          {{ store.reachable ? 'engine ok' : 'engine unreachable' }}
        </Badge>
      </div>
    </header>
    <RouterView />
  </div>
</template>
