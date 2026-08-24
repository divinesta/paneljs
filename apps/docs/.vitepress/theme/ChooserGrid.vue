<script setup>
import { withBase } from "vitepress";

defineProps({
   items: {
      type: Array,
      required: true,
   },
});
</script>

<template>
   <div class="chooser-grid">
      <component
         :is="item.href && !item.comingSoon ? 'a' : 'div'"
         v-for="item in items"
         :key="item.title"
         class="chooser-card"
         :class="{ 'is-soon': item.comingSoon }"
         :href="item.href && !item.comingSoon ? withBase(item.href) : undefined"
         :aria-disabled="item.comingSoon ? 'true' : undefined"
      >
         <span class="chooser-icon" aria-hidden="true">
            <img
               v-if="['express', 'prisma', 'typeorm', 'mikroorm'].includes(item.icon)"
               :src="withBase(`/icons/${item.icon}.svg`)"
               alt=""
            />
            <svg v-else-if="item.icon === 'fastify'" viewBox="0 0 48 48" fill="none">
               <path
                  d="M26 6 10 28h12l-4 14 20-26H26l4-10Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linejoin="round"
               />
            </svg>
            <svg v-else-if="item.icon === 'nest'" viewBox="0 0 48 48" fill="none">
               <path
                  d="M24 8c8 6 12 12 12 20a12 12 0 0 1-24 0c0-8 4-14 12-20Z"
                  stroke="currentColor"
                  stroke-width="2"
               />
               <path d="M24 16c4 4 6 8 6 12a6 6 0 1 1-12 0c0-4 2-8 6-12Z" stroke="currentColor" stroke-width="2" />
            </svg>
            <svg v-else-if="item.icon === 'drizzle'" viewBox="0 0 48 48" fill="none">
               <path
                  d="M18 8c0 8-8 12-8 20a8 8 0 0 0 16 0c0-8-8-12-8-20Z"
                  stroke="currentColor"
                  stroke-width="2"
               />
               <path
                  d="M32 4c0 8-8 12-8 20a8 8 0 0 0 16 0c0-8-8-12-8-20Z"
                  stroke="currentColor"
                  stroke-width="2"
               />
            </svg>
         </span>
         <span class="chooser-title">{{ item.title }}</span>
         <span v-if="item.comingSoon" class="chooser-hint">Coming soon</span>
         <span v-else-if="item.hint" class="chooser-hint">{{ item.hint }}</span>
      </component>
   </div>
</template>
