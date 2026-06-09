<template>
  <div id="viewer-container" 
       class="viewer-content w-full h-full overflow-y-auto no-scrollbar flex flex-col items-center"
       @scroll.passive="handleScroll">
    
    <!-- Render the actual content (Image/Text) -->
    <slot></slot>

  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';

const props = defineProps({
  onScrollUpdate: { type: Function, required: true }
});

function handleScroll(e) {
  props.onScrollUpdate(e);
}

onMounted(() => {
  console.log('[V2:ScrollLayer] Mounted');
});
</script>

<style scoped>
#viewer-container {
  scroll-behavior: auto; /* Use instant for markers */
}
</style>
