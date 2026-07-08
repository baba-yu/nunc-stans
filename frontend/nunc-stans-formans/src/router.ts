import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'

// FourFive is not a route: it is its own SPA mounted at /fourfive/ on the
// same origin, reached by a plain link in the topbar.
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/world', component: () => import('./views/WorldView.vue') },
    { path: '/timeline', component: () => import('./views/TimelineView.vue') },
    { path: '/profiles', component: () => import('./views/ProfilesView.vue') },
    { path: '/runs', component: () => import('./views/RunsView.vue') },
  ],
})
