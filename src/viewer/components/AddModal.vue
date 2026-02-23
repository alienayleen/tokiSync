<template>
  <transition name="fade">
    <div v-if="isAddModalOpen" class="fixed inset-0 z-[4000] flex items-center justify-center p-8 bg-black/98 backdrop-blur-xl text-white text-center">
      <div class="bg-[#1c1c1e] w-full max-w-xl p-16 rounded-[60px] border border-white/5 shadow-2xl">
        <h2 class="text-5xl font-black mb-16 uppercase tracking-tighter italic underline decoration-blue-600 decoration-[16px] underline-offset-[20px]">Register</h2>
        <div class="space-y-8 mb-16 text-left">
          <div class="space-y-3 text-white">
            <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-2">Series Metadata</label>
            <input v-model="newItem.title" placeholder="Entry title..." class="w-full bg-black/50 border border-white/5 p-6 rounded-3xl outline-none focus:ring-2 focus:ring-blue-600 transition-all font-black text-lg italic text-white">
          </div>
          <div class="grid grid-cols-3 gap-3">
            <button v-for="t in ['webtoon', 'manga', 'novel']" :key="t" @click="newItem.type = t"
                    :class="newItem.type === t ? 'bg-blue-600 text-white shadow-2xl scale-105' : 'bg-white/5 text-zinc-500'"
                    class="py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">{{ t }}</button>
          </div>
          <div class="space-y-3">
            <label class="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-2">Drive Resource Identifier</label>
            <input v-model="newItem.fileId" placeholder="Google Drive ID" class="w-full bg-black/50 border border-white/5 p-6 rounded-3xl outline-none focus:ring-2 focus:ring-blue-600 transition-all font-mono text-xs tracking-tighter text-zinc-400">
          </div>
        </div>
        <button @click="addNewItem" class="w-full bg-white text-black py-7 rounded-[40px] font-black uppercase shadow-2xl hover:bg-blue-600 hover:text-white active:scale-95 transition-all tracking-[0.5em] text-sm">Deploy to Cloud</button>
        <button @click="isAddModalOpen = false" class="mt-10 text-[11px] text-zinc-800 uppercase font-black tracking-[0.6em] hover:text-zinc-500 transition-colors">Abort Mission</button>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { useStore } from '../composables/useStore';
const { isAddModalOpen, newItem, addNewItem } = useStore();
</script>
