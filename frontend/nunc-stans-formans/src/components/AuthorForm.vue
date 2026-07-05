<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useMeStore } from '../stores/me'

const store = useMeStore()

const form = reactive({
  slug: '',
  title: '',
  started_at: '',
  money_jpy: '',
  hours: '',
  note: '',
})
const msg = ref('')
const isError = ref(false)

async function submit() {
  const res = await store.authorCommitment({ ...form })
  msg.value = res.message
  isError.value = !res.ok
  if (res.ok) {
    form.slug = ''
    form.title = ''
    form.started_at = ''
    form.money_jpy = ''
    form.hours = ''
    form.note = ''
  }
}
</script>

<template>
  <!-- The heading comes from the surrounding Panel's title. -->
  <form @submit.prevent="submit">
    <input v-model="form.slug" placeholder="slug (a-z, 0-9, -)" required pattern="[a-z0-9-]+" />
    <input v-model="form.title" placeholder="title" required />
    <input v-model="form.started_at" placeholder="started_at (YYYY-MM-DD)" required />
    <input v-model="form.money_jpy" placeholder="money_jpy (optional)" inputmode="numeric" />
    <input v-model="form.hours" placeholder="hours (optional)" inputmode="decimal" />
    <textarea v-model="form.note" placeholder="note (optional)" rows="2"></textarea>
    <button type="submit">Author (user peer)</button>
    <div id="msg" :class="{ warn: isError }">{{ msg }}</div>
  </form>
</template>
