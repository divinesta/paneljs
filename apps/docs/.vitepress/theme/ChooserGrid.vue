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
            <svg v-if="item.icon === 'express'" viewBox="0 0 48 48" fill="none">
               <rect x="4" y="10" width="40" height="28" rx="6" stroke="currentColor" stroke-width="2" />
               <path d="M12 24h24M18 18v12M30 18v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
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
            <svg v-else-if="item.icon === 'prisma'" viewBox="0 0 48 48" fill="none">
               <path
                  d="M28.5 8 10 36.5c-.8 1.3.2 3 1.7 2.8l12.2-1.6 6.4 7c1 .9 2.7.3 2.9-1.1L41 9.8c.3-1.5-1.2-2.6-2.5-1.9L28.5 8Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linejoin="round"
               />
            </svg>
            <svg v-else-if="item.icon === 'typeorm'" viewBox="0 0 48 48" fill="none">
               <path d="M8 16 24 8l16 8v16L24 40 8 32V16Z" stroke="currentColor" stroke-width="2" />
               <path d="M24 8v32M8 16l16 8 16-8" stroke="currentColor" stroke-width="2" />
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
