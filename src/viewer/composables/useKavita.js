/**
 * useKavita — Kavia 폴더 구조 변환 인터페이스
 * Viewer에서 GAS의 Kavita 변환 API를 호출합니다.
 */

import { ref } from 'vue';
import { useGAS } from './useGAS.js';

export function useKavita() {
  const { request } = useGAS();

  const isScanning = ref(false);
  const isProcessing = ref(false);
  const scanResult = ref(null);
  const progress = ref(null);

  /**
   * 라이브러리 구조 진단
   * @returns {Promise<Object>} { stats, byCategory, conflicts }
   */
  async function scanStructure() {
    isScanning.value = true;
    try {
      const res = await request('view_kavita_status', {});
      scanResult.value = res || { stats: { totalSeries: 0 }, byCategory: [], conflicts: [] };
      return scanResult.value;
    } finally {
      isScanning.value = false;
    }
  }

  /**
   * 선택된 시리즈 폴더 구조 변환 실행
   * @param {string[]} selectedIds - 변환할 시리즈 폴더 ID 배열 (빈 배열이면 전체)
   * @returns {Promise<Object>} { ok, moved, total, errors }
   */
  async function restructure(selectedIds = []) {
    isProcessing.value = true;
    progress.value = { status: '변환 중...', moved: 0, total: 0 };
    try {
      const result = await request('view_kavita_restructure', {
        selectedIds
      });
      progress.value = { status: result.ok ? '완료' : '오류 발생', ...result };
      return result;
    } finally {
      isProcessing.value = false;
    }
  }

  return {
    isScanning,
    isProcessing,
    scanResult,
    progress,
    scanStructure,
    restructure
  };
}
