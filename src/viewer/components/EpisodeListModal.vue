<template>
  <transition name="fade">
    <div v-if="showEpisodeModal" class="fixed inset-0 z-[4000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl">
      <div class="bg-[#1c1c1e] w-full max-w-xl rounded-[40px] border border-white/5 shadow-2xl overflow-hidden text-white">
        <div class="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div>
            <h3 class="font-black text-2xl tracking-tighter uppercase italic">{{ selectedItem?.title }}</h3>
            <p class="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Episodes List</p>
          </div>
          <button @click="showEpisodeModal = false" class="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full transition-all">&times;</button>
        </div>
        <div class="max-h-[60vh] overflow-y-auto p-4 no-scrollbar space-y-3">
          <div v-for="ep in episodes" :key="ep.id" @click="startReading(ep)"
               class="flex items-center p-5 rounded-3xl bg-white/5 hover:bg-blue-600 transition-all cursor-pointer group"
               :class="{'ring-2 ring-blue-500': currentEpisode?.id === ep.id}">
            <div class="w-24 aspect-video rounded-xl overflow-hidden bg-zinc-900 mr-6">
              <img :src="ep.thumbnail" class="w-full h-full object-cover">
            </div>
            <div class="flex-grow">
              <p class="text-base font-black tracking-tight group-hover:text-white">{{ ep.title }}</p>
              <p class="text-[10px] text-zinc-500 group-hover:text-blue-200 uppercase mt-1">{{ ep.date }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { useStore } from '../composables/useStore';
const { showEpisodeModal, selectedItem, episodes, currentEpisode, startReading } = useStore();
</script>
