<template>
  <main class="fixed inset-0 z-[3000] bg-black overflow-hidden flex flex-col items-center reader-main">

    <!-- Floating Header -->
    <transition name="fade">
      <div v-if="showViewerControls" class="fixed top-4 inset-x-4 md:top-8 md:inset-x-8 z-[100] glass-controls p-3 md:p-6 rounded-2xl md:rounded-[32px] flex justify-between items-center text-white shadow-2xl reader-header-safe">
        <button @click="exitViewer" class="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 flex items-center justify-center hover:bg-white/10 rounded-full transition-all">
          <svg class="w-6 h-6 md:w-7 md:h-7 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M15 19l-7-7 7-7"></path></svg>
        </button>

        <div class="flex-1 min-w-0 px-2 md:px-4 flex items-center justify-center space-x-3 md:space-x-6">
          <!-- 이전 에피소드 -->
          <button @click.stop="goToPrevEpisode" :disabled="!hasPrevEpisode"
                  class="flex-shrink-0 p-2 hover:bg-white/10 rounded-full transition-all disabled:opacity-20" title="이전 화">
            <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M15 19l-7-7 7-7"></path></svg>
          </button>

          <div class="min-w-0 overflow-hidden text-center">
            <p class="text-[8px] md:text-[9px] font-black tracking-[0.3em] md:tracking-[0.5em] uppercase text-blue-500 mb-0.5 truncate">{{ selectedItem?.title }}</p>
            <p class="text-xs md:text-sm font-black text-zinc-200 uppercase tracking-tighter truncate">{{ currentEpisode?.title }}</p>
          </div>

          <!-- 다음 에피소드 -->
          <button @click.stop="goToNextEpisode" :disabled="!hasNextEpisode"
                  class="flex-shrink-0 p-2 hover:bg-white/10 rounded-full transition-all disabled:opacity-20" title="다음 화">
            <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>

        <!-- 에피소드 목록 -->
        <button @click.stop="showEpisodeModal = true" class="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl md:rounded-[20px] transition-all" title="에피소드 목록">
          <svg class="w-5 h-5 md:w-6 md:h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        </button>
      </div>
    </transition>

    <!-- Navigation Interaction Zones (Page 모드 전용, Scroll 모드에서는 터치 스크롤 방해 방지) -->
    <div v-if="viewerData.mode !== 'scroll'" class="fixed inset-0 z-40 pointer-events-none" @wheel.passive="handleWheel">
      <div @click="handlePrev" class="nav-zone nav-left pointer-events-auto"></div>
      <div @click="toggleViewerUI" class="nav-zone nav-center pointer-events-auto"></div>
      <div @click="handleNext" class="nav-zone nav-right pointer-events-auto"></div>
    </div>

    <!-- Engine Viewport -->
    <div id="viewer-container" class="viewer-content w-full h-full overflow-y-auto no-scrollbar flex flex-col items-center"
         :class="[viewerData.mode === 'scroll' ? 'overflow-y-auto' : 'overflow-hidden', selectedItem?.type === 'novel' ? `theme-${novelSettings.theme}` : 'bg-black']"
         @scroll.passive="onScrollUpdate">

      <!-- Scroll Mode -->
      <div v-if="viewerData.mode === 'scroll'" class="max-w-4xl w-full" :class="selectedItem?.type === 'novel' ? 'py-64 px-16' : ''">
        <template v-if="selectedItem?.type !== 'novel'">
          <img v-for="i in 10" :key="i" :src="`https://picsum.photos/seed/${currentEpisode?.id}_${i}/1200/1800`" class="w-full h-auto block select-none shadow-2xl border-b border-white/5" loading="lazy">
        </template>
        <template v-else>
          <h1 class="text-5xl font-black mb-24 opacity-80 border-b-8 border-blue-600 pb-16 tracking-tighter italic uppercase leading-none">{{ currentEpisode?.title }}</h1>
          <div class="leading-[2.8] opacity-90 space-y-16 tracking-tight font-medium" :style="{ fontSize: novelSettings.fontSize + 'px' }">
            {{ fullNovelContent }}
          </div>
        </template>
      </div>

      <!-- Page Mode -->
      <div v-else class="h-full w-full flex items-center justify-center overflow-hidden">
        <div v-if="selectedItem?.type !== 'novel'" class="spread-layout" :dir="viewerDefaults.rtl ? 'rtl' : 'ltr'">
          <template v-if="!viewerDefaults.spread || (currentPage === 1 && viewerDefaults.coverFirst)">
            <img :key="'p'+currentPage" :src="`https://picsum.photos/seed/${currentEpisode?.id}_${currentPage}/1200/1800`" class="single-image shadow-2xl">
          </template>
          <template v-else>
            <img :key="'p'+currentPage" :src="`https://picsum.photos/seed/${currentEpisode?.id}_${currentPage}/1200/1800`" class="spread-image shadow-2xl">
            <img v-if="currentPage < 10" :key="'p'+(currentPage+1)" :src="`https://picsum.photos/seed/${currentEpisode?.id}_${currentPage+1}/1200/1800`" class="spread-image shadow-2xl">
          </template>
        </div>
        <div v-else class="max-w-3xl w-full py-20 px-16 text-justify">
          <div class="leading-[2.8] opacity-90 text-current" :style="{ fontSize: novelSettings.fontSize + 'px' }">
            {{ paginatedNovelData[currentPage - 1] || '콘텐츠를 불러오는 중이거나 끝에 도달했습니다.' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Footer -->
    <transition name="slide-up">
      <div v-if="showViewerControls" class="fixed bottom-4 inset-x-4 md:bottom-8 md:inset-x-8 z-[100] glass-controls p-5 md:p-10 rounded-2xl md:rounded-[40px] flex flex-col space-y-4 md:space-y-10 shadow-2xl text-white reader-footer-safe">
        <div class="flex items-center space-x-4 md:space-x-10 text-white">
          <button @click="handlePrev" class="text-zinc-600 hover:text-white transition-colors text-lg md:text-2xl">◀</button>
          <input type="range" class="flex-grow accent-[#3498db] h-1 rounded-full bg-zinc-800 appearance-none cursor-pointer" v-model.number="currentPage" min="1" max="10">
          <button @click="handleNext" class="text-zinc-600 hover:text-white transition-colors text-lg md:text-2xl">▶</button>
        </div>
        <div class="flex flex-wrap justify-center gap-4 md:gap-16 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.5em] text-zinc-600">
          <button @click="viewerDefaults.spread = !viewerDefaults.spread" :class="{'text-white underline decoration-blue-600 underline-offset-4 md:underline-offset-8': viewerDefaults.spread}">Spread</button>
          <button @click="setViewerMode(viewerData.mode === 'scroll' ? 'page' : 'scroll')" :class="{'text-white underline decoration-blue-600 underline-offset-4 md:underline-offset-8': viewerData.mode === 'scroll'}">Scroll</button>
          <button @click="viewerDefaults.rtl = !viewerDefaults.rtl" :class="{'text-white underline decoration-blue-600 underline-offset-4 md:underline-offset-8': viewerDefaults.rtl}">RTL</button>
          <span class="text-blue-500 font-black">{{ viewerData.mode === 'scroll' ? scrollProgress + '%' : currentPage + ' / 10' }}</span>
        </div>
      </div>
    </transition>
  </main>
</template>

<script setup>
import { onMounted, onUnmounted, nextTick } from 'vue';
import { useStore } from '../composables/useStore';
import { useTouch } from '../composables/useTouch';
import { useKeyboard } from '../composables/useKeyboard';

const {
  showViewerControls, showEpisodeModal,
  selectedItem, currentEpisode, currentPage, scrollProgress,
  viewerDefaults, viewerData, novelSettings,
  fullNovelContent, paginatedNovelData,
  hasNextEpisode, hasPrevEpisode,
  exitViewer, goToNextEpisode, goToPrevEpisode,
  toggleViewerUI, setViewerMode,
  handleWheel, handleNext, handlePrev, onScrollUpdate,
} = useStore();

const touch = useTouch();
const keyboard = useKeyboard();

onMounted(() => {
  touch.attach();
  keyboard.attach();
});

onUnmounted(() => {
  touch.detach();
  keyboard.detach();
});
</script>
