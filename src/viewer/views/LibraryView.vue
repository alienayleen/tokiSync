<template>
  <main class="max-w-7xl mx-auto w-full p-10 md:p-16">
    <div class="flex flex-col md:flex-row justify-between items-end mb-16 gap-10">
      <div>
        <h2 class="text-4xl font-black tracking-tighter mb-4 italic text-white">My Collections</h2>
        <div class="flex space-x-2">
          <button v-for="tab in tabs" :key="tab.value" @click="currentTab = tab.value"
                  :class="currentTab === tab.value ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-500'"
                  class="px-6 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest">{{ tab.label }}</button>
        </div>
      </div>
      <div class="relative w-full md:w-[400px] group">
        <input v-model="searchQuery" type="text" placeholder="Search..." class="w-full bg-white/5 border border-white/5 rounded-[24px] px-8 py-5 pl-16 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-white">
        <svg class="w-6 h-6 absolute left-6 top-4.5 text-zinc-700 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-width="3"></path></svg>
      </div>
    </div>

    <!-- Shimmer Loading Skeleton -->
    <div v-if="isInitialLoading" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-10">
      <div v-for="i in 12" :key="i" class="space-y-4"><div class="aspect-cover rounded-[32px] shimmer shadow-2xl"></div></div>
    </div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-10">
      <div v-for="item in filteredLibrary" :key="item.id" @click="openSeries(item)" class="group cursor-pointer">
        <div class="relative aspect-cover rounded-[36px] overflow-hidden card-hover bg-zinc-900 shadow-2xl border border-white/5 transition-all">
          <img :src="item.cover" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700">
        </div>
        <div class="mt-6 px-2 text-white">
          <h4 class="font-black text-sm truncate tracking-tighter group-hover:text-blue-400 transition-colors uppercase italic">{{ item.title }}</h4>
          <div class="flex justify-between items-center mt-2">
            <span class="text-[9px] font-black text-zinc-600 uppercase">{{ item.type }}</span>
            <span class="text-[9px] font-bold text-blue-500">{{ item.episodeCount }} EPs</span>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { useStore } from '../composables/useStore';
const { currentTab, tabs, searchQuery, isInitialLoading, filteredLibrary, openSeries } = useStore();
</script>
