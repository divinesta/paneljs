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
               v-if="['express', 'fastify', 'nest', 'prisma', 'typeorm', 'mikroorm'].includes(item.icon)"
               :src="withBase(`/icons/${item.icon === 'nest' ? 'nestjs' : item.icon}.svg`)"
               alt=""
            />
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
