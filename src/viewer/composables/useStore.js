import { ref, reactive, computed, watch } from 'vue';
import Dexie from 'dexie';

// --- Dexie.js (Offline-First Cache) ---
const db = new Dexie('ViewerHubDB');
db.version(1).stores({ library: '++id, title, type, fileId, progress' });

// --- Singleton State ---
const currentView = ref('library');
const showSettings = ref(false);
const showViewerControls = ref(false);
const isAddModalOpen = ref(false);
const showEpisodeModal = ref(false);
const isInitialLoading = ref(true);
const isSyncing = ref(false);
const notification = ref('');

const config = reactive({ deploymentId: '', apiKey: '', folderId: '' });
const viewerDefaults = reactive({ spread: true, rtl: false, coverFirst: true });
const viewerData = reactive({ mode: 'page' });
const novelSettings = reactive({ theme: 'dark', fontSize: 26, lastMode: 'scroll' });

const searchQuery = ref('');
const currentTab = ref('all');
const tabs = [
  { label: 'TOTAL', value: 'all' },
  { label: 'Webtoon', value: 'webtoon' },
  { label: 'Manga', value: 'manga' },
  { label: 'Novel', value: 'novel' },
];

const libraryItems = ref([]);
const selectedItem = ref(null);
const currentEpisode = ref(null);
const currentPage = ref(1);
const scrollProgress = ref(0); // 0~100 스크롤 진행률
const isScrollSyncing = ref(false); // 슬라이더→스크롤 동기화 플래그
const newItem = reactive({ title: '', type: 'webtoon', fileId: '' });

const episodes = ref([
  { id: 'EP1', title: 'Chapter 001: Ascension of the King', thumbnail: 'https://picsum.photos/seed/1/800/450', date: 'JAN 01 2026', isRead: true },
  { id: 'EP2', title: 'Chapter 002: Hidden Dungeon Quest', thumbnail: 'https://picsum.photos/seed/2/800/450', date: 'JAN 08 2026', isRead: false },
  { id: 'EP3', title: 'Chapter 003: The Blood-Stained Sword', thumbnail: 'https://picsum.photos/seed/3/800/450', date: 'JAN 15 2026', isRead: false },
  { id: 'EP4', title: 'Chapter 004: Shadow Realm Unlocked', thumbnail: 'https://picsum.photos/seed/4/800/450', date: 'JAN 22 2026', isRead: false },
  { id: 'EP5', title: 'Chapter 005: A New Companion', thumbnail: 'https://picsum.photos/seed/5/800/450', date: 'JAN 29 2026', isRead: false },
]);

// --- Computed ---
const currentEpisodeIndex = computed(() => {
  return episodes.value.findIndex(ep => ep.id === currentEpisode.value?.id);
});
const hasNextEpisode = computed(() => currentEpisodeIndex.value < episodes.value.length - 1);
const hasPrevEpisode = computed(() => currentEpisodeIndex.value > 0);

const filteredLibrary = computed(() => libraryItems.value.filter(item => {
  const matchTab = currentTab.value === 'all' || item.type === currentTab.value;
  return matchTab && item.title.toLowerCase().includes(searchQuery.value.toLowerCase());
}));

const novelContentBase = `안티그래비티 v1.4.0 리더 엔진의 통합 렌더링 시스템입니다. \n\n이 본문은 사용자가 선택한 모드(스크롤/페이지)에 관계없이 동일한 원본 데이터를 공유합니다. 스크롤 모드에서는 전체 내용을 한 번에 보여주며, 페이지 모드에서는 내용을 적절히 분할하여 쪽 단위로 보여줍니다. \n\n현재 이 기능은 GAS v90 라이브러리와 연동될 준비가 되어 있으며, 모든 독서 진행률은 실시간으로 클라우드에 백업됩니다.`;
const fullNovelContent = computed(() => novelContentBase);
const paginatedNovelData = computed(() => {
  const words = novelContentBase.split(' ');
  const pages = [];
  const wordsPerPage = 20;
  for (let i = 0; i < words.length; i += wordsPerPage) {
    pages.push(words.slice(i, i + wordsPerPage).join(' '));
  }
  return pages;
});

// --- Methods ---
const notify = (msg) => {
  notification.value = msg;
  setTimeout(() => notification.value = '', 3000);
};

const forceCloudSync = () => {
  isSyncing.value = true;
  setTimeout(() => isSyncing.value = false, 2000);
};

const initApp = async () => {
  isInitialLoading.value = true;
  setTimeout(async () => {
    const items = await db.library.toArray();
    if (items.length === 0) {
      await db.library.bulkAdd([
        { title: 'Solo Leveling', type: 'webtoon', cover: 'https://picsum.photos/seed/lev/800/1200', progress: 85, episodeCount: 179 },
        { title: 'One Piece (V105)', type: 'manga', cover: 'https://picsum.photos/seed/op/800/1200', progress: 10, episodeCount: 1100 },
        { title: 'Omniscient Reader', type: 'novel', cover: 'https://picsum.photos/seed/read/800/1200', progress: 42, episodeCount: 550 },
        { title: 'Berserk', type: 'manga', cover: 'https://picsum.photos/seed/ber/800/1200', progress: 5, episodeCount: 364 },
      ]);
    }
    libraryItems.value = await db.library.toArray();
    isInitialLoading.value = false;
  }, 1500);
};

const openSeries = (item) => {
  selectedItem.value = item;
  currentView.value = 'episodes';
  window.scrollTo(0, 0);
};

const startReading = (ep) => {
  currentEpisode.value = ep;
  currentPage.value = 1;
  const type = selectedItem.value.type;

  if (type === 'webtoon') viewerData.mode = 'scroll';
  else if (type === 'manga') viewerData.mode = 'page';
  else viewerData.mode = novelSettings.lastMode;

  currentView.value = 'viewer';
  showViewerControls.value = false;
  showEpisodeModal.value = false;
  window.scrollTo(0, 0);
};

const goToNextEpisode = () => {
  if (hasNextEpisode.value) {
    const nextEp = episodes.value[currentEpisodeIndex.value + 1];
    startReading(nextEp);
    notify(`Moved to ${nextEp.title}`);
    forceCloudSync();
  }
};

const goToPrevEpisode = () => {
  if (hasPrevEpisode.value) {
    const prevEp = episodes.value[currentEpisodeIndex.value - 1];
    startReading(prevEp);
    notify(`Moved to ${prevEp.title}`);
    forceCloudSync();
  }
};

const exitViewer = () => {
  currentView.value = 'episodes';
  forceCloudSync();
};

const goBackToLibrary = () => {
  currentView.value = 'library';
  forceCloudSync();
};

const toggleViewerUI = () => {
  showViewerControls.value = !showViewerControls.value;
};

const setViewerMode = (mode) => {
  viewerData.mode = mode;
  if (selectedItem.value?.type === 'novel') novelSettings.lastMode = mode;
};

const handleWheel = (e) => {
  if (viewerData.mode === 'scroll') {
    const container = document.getElementById('viewer-container');
    if (container) container.scrollTop += e.deltaY;
  }
};

// 스크롤 이벤트 → currentPage 동기화
const onScrollUpdate = () => {
  const container = document.getElementById('viewer-container');
  if (!container) return;
  const { scrollTop, scrollHeight, clientHeight } = container;
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0) return;
  const pct = Math.min(scrollTop / maxScroll, 1);
  scrollProgress.value = Math.round(pct * 100);
  // 스크롤→페이지 업데이트 시 watch 재진입 방지
  isScrollSyncing.value = true;
  currentPage.value = Math.max(1, Math.min(10, Math.round(pct * 9) + 1));
  // nextTick 이후 플래그 해제 (watch가 먼저 실행되도록)
  Promise.resolve().then(() => { isScrollSyncing.value = false; });
};

// 슬라이더(currentPage) 변경 → 스크롤 위치 동기화 (사용자 슬라이더 조작 전용)
watch(currentPage, (newPage) => {
  if (viewerData.mode !== 'scroll') return;
  if (isScrollSyncing.value) return; // 스크롤에서 온 변경이면 무시
  const container = document.getElementById('viewer-container');
  if (!container) return;
  const maxScroll = container.scrollHeight - container.clientHeight;
  if (maxScroll <= 0) return;
  const targetScroll = ((newPage - 1) / 9) * maxScroll;
  container.scrollTo({ top: targetScroll, behavior: 'smooth' });
});

const next = () => {
  if (viewerData.mode === 'scroll') {
    const container = document.getElementById('viewer-container');
    container.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
  } else {
    let step = 1;
    if (viewerDefaults.spread) {
      step = (currentPage.value === 1 && viewerDefaults.coverFirst) ? 1 : 2;
    }
    if (currentPage.value + step <= 10) currentPage.value += step;
    else notify("Last page reached.");
  }
};

const prev = () => {
  if (viewerData.mode === 'scroll') {
    const container = document.getElementById('viewer-container');
    container.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
  } else {
    let step = 1;
    if (viewerDefaults.spread) {
      step = (currentPage.value === 2 && viewerDefaults.coverFirst) ? 1 : 2;
    }
    if (currentPage.value - step >= 1) currentPage.value -= step;
    else notify("First page reached.");
  }
};

const handleNext = () => {
  if (viewerDefaults.rtl) { prev(); return; }
  next();
};

const handlePrev = () => {
  if (viewerDefaults.rtl) { next(); return; }
  prev();
};

const addNewItem = () => {
  isAddModalOpen.value = false;
  notify("Deployment to Cloud Successful");
};

const deleteItem = () => {
  currentView.value = 'library';
  notify("Collection Removed");
};

const reloadApp = () => window.location.reload();

// --- Composable Export ---
export function useStore() {
  return {
    // UI State
    currentView, showSettings, showViewerControls, isAddModalOpen, showEpisodeModal,
    isInitialLoading, isSyncing, notification,

    // Config & Settings
    config, viewerDefaults, viewerData, novelSettings,

    // Data
    searchQuery, currentTab, tabs,
    libraryItems, filteredLibrary, selectedItem,
    episodes, currentEpisode, currentEpisodeIndex,
    currentPage, scrollProgress, newItem,

    // Episode Nav Computed
    hasNextEpisode, hasPrevEpisode,

    // Novel Content
    fullNovelContent, paginatedNovelData,

    // Methods
    notify, forceCloudSync, initApp,
    openSeries, startReading, exitViewer, goBackToLibrary,
    goToNextEpisode, goToPrevEpisode,
    toggleViewerUI, setViewerMode,
    handleWheel, handleNext, handlePrev, onScrollUpdate,
    addNewItem, deleteItem, reloadApp,
  };
}
