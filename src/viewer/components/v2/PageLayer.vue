<template>
  <div class="viewer-content w-full h-full overflow-hidden flex flex-col items-center justify-center relative">
    
    <!-- Page Navigation Guide (Overlay) -->
    <transition name="fade">
      <slot name="overlay"></slot>
    </transition>

    <!-- The Content Spread/Single Layout -->
    <div class="h-full w-full flex items-center justify-center overflow-hidden">
      <slot></slot>
    </div>

  </div>
</template>

<script setup>
import { onMounted } from 'vue';

onMounted(() => {
  console.log('[V2:PageLayer] Mounted');
});
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
