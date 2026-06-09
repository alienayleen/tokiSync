<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header & Settings (hidden in reader) -->
    <NavHeader v-if="currentView !== 'viewer'" />
    <SettingsPanel />

    <!-- View Router -->
    <transition name="fade" mode="out-in">
      <LibraryView v-if="currentView === 'library'" key="library" />
      <EpisodesView v-else-if="currentView === 'episodes'" key="episodes" />
      <template v-else-if="currentView === 'viewer'">
        <ReaderView v-if="viewerDefaults.viewerVersion === 1" key="viewer-v1" />
        <ReaderViewV2 v-else-if="viewerDefaults.viewerVersion === 2" key="viewer-v2" />
      </template>
    </transition>

    <!-- Global Modals -->
    <DownloadManagerView />
    <EpisodeListModal />
    <NotificationToast />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useStore } from './composables/useStore';

// Components
import NavHeader from './components/NavHeader.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import EpisodeListModal from './components/EpisodeListModal.vue';
import NotificationToast from './components/NotificationToast.vue';

// Views
import LibraryView from './views/LibraryView.vue';
import EpisodesView from './views/EpisodesView.vue';
import ReaderView from './views/ReaderView.vue';
import ReaderViewV2 from './views/ReaderViewV2.vue';
import DownloadManagerView from './views/DownloadManagerView.vue';

const { currentView, viewerDefaults, initApp } = useStore();

onMounted(initApp);
</script>
