<template>
  <nav class="sticky top-0 z-50 glass-header px-8 py-5 flex justify-between items-center text-white">
    <div class="flex items-center space-x-10">
      <button v-if="currentView === 'episodes'" @click="goBackToLibrary" class="p-2 hover:bg-white/10 rounded-full transition-all">
        <svg class="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
      </button>
      <div v-if="currentView === 'library'" class="flex items-center space-x-3 cursor-pointer group" @click="reloadApp">
        <div class="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg">TS</div>
        <h1 class="text-2xl font-black tracking-tighter uppercase group-hover:text-blue-400 transition-colors italic text-white">TokiSync <span class="text-yellow-400">⚡️</span></h1>
      </div>
    </div>
    <div class="flex items-center space-x-6">
      <div v-if="isSyncing" class="flex items-center text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">
        <svg class="w-3.5 h-3.5 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
        Syncing
      </div>
      <button @click="showSettings = !showSettings" class="p-2 text-zinc-500 hover:text-white transition-colors" :class="{'text-white': showSettings}">⚙️</button>
      <button @click="isAddModalOpen = true" class="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-full text-[11px] font-black shadow-xl tracking-widest">+ ADD NEW</button>
    </div>
  </nav>
</template>

<script setup>
import { useStore } from '../composables/useStore';
const { currentView, showSettings, isAddModalOpen, isSyncing, goBackToLibrary, reloadApp } = useStore();
</script>
