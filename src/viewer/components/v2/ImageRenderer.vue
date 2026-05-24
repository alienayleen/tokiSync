<template>
  <div class="v2-image-renderer w-full flex flex-col items-center">
    
    <!-- Render each image segment -->
    <div v-for="(src, idx) in images" 
         :key="idx"
         class="v2-segment v2-image-segment w-full"
         :data-locator="idx">
      
      <img :src="src" 
           @load="onImgLoad(idx)"
           @error="onImgError(idx)"
           class="v2-img block w-full h-auto"
           :loading="idx <= (markerIndex || 0) ? 'eager' : 'lazy'"
           :style="{ minHeight: loadedImages.has(idx) ? 'auto' : (avgHeight > 0 ? avgHeight + 'px' : '200px') }">
           
    </div>

    <slot></slot>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';

const props = defineProps({
  images: { type: Array, required: true },
  markerIndex: { type: Number, default: 0 }
});

const emit = defineEmits(['ready', 'heuristic-ready']);
const loadedCount = ref(0);
const loadedImages = ref(new Set()); // Track individually loaded images to release min-height constraints
const firstThreeHeights = ref({});
const avgHeight = ref(0);

function onImgLoad(idx) {
  try {
    loadedCount.value++;
    loadedImages.value.add(idx); // Register image as fully loaded
    
    // [v2.8] Heuristic: Capture RENDERED height for the first 3 images
    const el = document.querySelector(`[data-locator="${idx}"] img`);
    if (el && idx <= 2) {
      const height = el.offsetHeight; // Use actual rendered pixels
      if (height > 100) { 
        firstThreeHeights.value[idx] = height;
        const keys = Object.keys(firstThreeHeights.value);
        if (keys.length === 3) {
          const sum = (firstThreeHeights.value[0] || 0) + (firstThreeHeights.value[1] || 0) + (firstThreeHeights.value[2] || 0);
          const avg = sum / 3;
          avgHeight.value = avg;
          console.log(`[V2:Heuristic] Top-3 Avg Height: ${avg}px`);
          emit('heuristic-ready', avg);
        }
      }
    }
  } catch (e) {
    console.warn('[V2:ImageRenderer] Heuristic Error:', e);
  }
}

function onImgError(idx) {
  console.error(`[V2:ImageRenderer] Failed to load image ${idx}`);
  loadedCount.value++;
  loadedImages.value.add(idx); // Register even if failed to release min-height placeholder constraint
}

onMounted(async () => {
  await nextTick();
  // We notify "ready" as soon as the DOM containers are created.
  // This triggers the initial (0-offset) jump, while heuristic-ready will trigger the guessed jump.
  emit('ready');
});
</script>

<style scoped>
.v2-image-renderer {
  margin: 0 auto;
  max-width: 896px; /* [v2.9] Desktop optimization (V1 parity) */
}
.v2-image-segment {
  /* Ensure zero gap for seamless scrolling */
  margin-bottom: 0;
}
.v2-img {
  min-height: 200px;
  background: rgba(255, 255, 255, 0.05); /* Minimal placeholder */
}
</style>
