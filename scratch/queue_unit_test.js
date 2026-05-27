import { 
  getQueue, 
  addEpisodesToQueue, 
  updateQueueItem, 
  clearQueue, 
  removeCompletedItems, 
  getQueueStats 
} from '../src/core/queue.js';

// Node.js 환경이므로 localStorage Mocking 주입
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, value) => { mockStorage[key] = value; },
  removeItem: (key) => { delete mockStorage[key]; }
};

console.log('🧪 Starting tokiSync Queue Core Unit Test...');

try {
  // 1. 초기 큐가 비어있는지 검사
  console.assert(getQueue().length === 0, 'Initial queue should be empty');

  // 2. 에피소드 다중 등록
  const mockEpisodes = [
    { title: '1화 - 시작', url: 'https://toki.com/1', episodeNum: 1 },
    { title: '2화 - 위기', url: 'https://toki.com/2', episodeNum: 2 },
    { title: '3화 - 절정', url: 'https://toki.com/3', episodeNum: 3 }
  ];
  const addedCount = addEpisodesToQueue(mockEpisodes, 'TestNovel');
  console.assert(addedCount === 3, `Should add 3 items, added: ${addedCount}`);
  console.assert(getQueue().length === 3, 'Queue length should be 3');

  // 3. 중복 등록 차단 검증
  const reAddedCount = addEpisodesToQueue(mockEpisodes, 'TestNovel');
  console.assert(reAddedCount === 0, `Duplicate items should not be added, added: ${reAddedCount}`);

  // 4. 상태 업데이트
  const testId = 'TestNovel_1';
  updateQueueItem(testId, { status: 'processing' });
  let currentQueue = getQueue();
  let updatedItem = currentQueue.find(item => item.id === testId);
  console.assert(updatedItem.status === 'processing', `Item state should be processing, got: ${updatedItem.status}`);

  // 5. 완료 처리 및 통계 검증
  updateQueueItem(testId, { status: 'completed' });
  updateQueueItem('TestNovel_2', { status: 'failed', errorMsg: 'Network timeout' });
  const stats = getQueueStats();
  console.assert(stats.completed === 1, `Completed count should be 1, got: ${stats.completed}`);
  console.assert(stats.failed === 1, `Failed count should be 1, got: ${stats.failed}`);
  console.assert(stats.pending === 1, `Pending count should be 1, got: ${stats.pending}`);

  // 6. 완료 항목 일괄 제거
  removeCompletedItems();
  console.assert(getQueue().length === 2, `Queue length should be 2 after removing completed items, got: ${getQueue().length}`);

  // 7. 큐 전체 비우기
  clearQueue();
  console.assert(getQueue().length === 0, 'Queue should be completely empty after clear');

  console.log('✅ tokiSync Queue Core Unit Test completed successfully without errors!');
} catch (e) {
  console.error('❌ test failed:', e);
  process.exit(1);
}
