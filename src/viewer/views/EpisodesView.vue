<template>
  <main class="w-full min-h-screen bg-[#0f0f10]">
    <!-- Hero Section -->
    <div class="relative w-full h-[550px] md:h-[750px] overflow-hidden">
      <img :src="selectedItem?.cover" class="absolute inset-0 w-full h-full object-cover blur-[100px] opacity-20 scale-150">
      <div class="absolute inset-0 bg-gradient-to-b from-transparent via-black/60 to-[#0f0f10]"></div>
      <div class="relative max-w-6xl mx-auto h-full flex flex-col md:flex-row items-end p-12 md:p-24 gap-20 text-white">
        <div class="hidden md:block w-80 shadow-2xl rounded-[50px] overflow-hidden aspect-cover border border-white/10 ring-[25px] ring-white/5 transform -rotate-3">
          <img :src="selectedItem?.cover" class="w-full h-full object-cover">
        </div>
        <div class="pb-12 flex-grow text-white">
          <h2 class="text-7xl md:text-9xl font-black mb-12 tracking-tighter leading-[0.85] uppercase italic">{{ selectedItem?.title }}</h2>
          <div class="flex gap-8">
            <button @click="startReading(episodes[0])" class="bg-white text-black px-20 py-6 rounded-[32px] font-black shadow-2xl transition-all hover:bg-blue-500 hover:text-white hover:scale-105 active:scale-95 tracking-[0.2em] text-sm uppercase">Read Now</button>
            <button @click="deleteItem(selectedItem.id)" class="bg-white/5 text-zinc-600 px-12 py-6 rounded-[32px] font-black border border-white/5 transition-all hover:bg-red-600/20 hover:text-red-500 tracking-widest text-xs uppercase">Discard</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Episode List -->
    <div class="max-w-6xl mx-auto p-12 md:p-24 pt-0">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div v-for="ep in episodes" :key="ep.id" @click="startReading(ep)" class="flex items-center p-8 rounded-[40px] bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/50 transition-all cursor-pointer group">
          <div class="w-40 md:w-60 aspect-video rounded-[24px] overflow-hidden bg-zinc-900 relative shadow-2xl flex-shrink-0">
            <img :src="ep.thumbnail" class="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700">
            <div v-if="ep.isRead" class="absolute inset-0 bg-blue-900/40 flex items-center justify-center text-[11px] font-black tracking-[0.5em] text-white uppercase backdrop-blur-[2px]">Read</div>
          </div>
          <div class="ml-10 flex-grow overflow-hidden text-white">
            <h5 class="font-black text-2xl group-hover:text-blue-400 transition-colors uppercase italic truncate tracking-tighter">{{ ep.title }}</h5>
            <p class="text-[10px] text-zinc-600 font-black uppercase tracking-[0.3em] mt-3">{{ ep.date }}</p>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { useStore } from '../composables/useStore';
const { selectedItem, episodes, startReading, deleteItem } = useStore();
</script>
