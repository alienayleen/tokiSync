import { watch } from 'vue';
import { useStore } from './useStore';

/**
 * useViewerInput - 통합 입력 컨트롤러 (v2.1)
 *
 * 기존 useTouch.js를 완전 대체합니다.
 * 마우스 클릭, 터치 탭/스와이프를 단일 핸들러로 처리하며
 * 터치 후 브라우저가 300ms 뒤에 발생시키는 ghost click을 방지합니다.
 *
 * 영역 분할 (viewer-container 기준):
 *   좌 15% → handlePrev
 *   우 15% → handleNext
 *   중앙    → toggleViewerUI
 *
 * 키보드는 useKeyboard.js가 계속 담당합니다.
 *
 * 개선 포인트 (v2.1):
 * - isUIElement에 .viewer-toolbar 추가
 * - touchmove 리스너를 뷰어 모드에 따라 동적 교체
 *   (페이지 모드: passive:false / 스크롤 모드: passive:true)
 * - iOS Safari에서 스크롤 모드 장시간 사용 시 저하 현상 방지
 */
export function useViewerInput() {
  const {
    currentView,
    viewerData,
    handleNext,
    handlePrev,
    toggleViewerUI,
  } = useStore();

  // 터치 이후 ghost click 방지용 타임스탬프
  let lastTouchEndTime = 0;
  const GHOST_CLICK_THRESHOLD = 500; // ms

  // 스와이프 추적 상태
  let touchStartX = 0;
  let touchStartY = 0;
  let tracking = false;
  const SWIPE_THRESHOLD = 40;

  /**
   * 클릭 좌표(clientX) 기준으로 뷰어 영역 판별
   * @returns {'prev'|'toggle'|'next'}
   */
  const getZone = (clientX) => {
    const w = window.innerWidth;
    if (clientX < w * 0.15) return 'prev';
    if (clientX > w * 0.85) return 'next';
    return 'toggle';
  };

  /**
   * UI 요소 위 이벤트인지 확인 (헤더/푸터/보턴 등은 무시)
   * viewer-toolbar 선택자 추가(v2.1 개선)
   */
  const isUIElement = (el) => {
    return !!el?.closest(
      '.glass-controls, .viewer-toolbar, [class*="z-[4000]"], button, input, select, a, label'
    );
  };

  // ── 마우스 핸들러 ────────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (currentView.value !== 'viewer') return;
    if (e.button !== 0) return; // 좌클릭만
    if (isUIElement(e.target)) return;

    // 터치 후 발생하는 ghost mousedown 무시
    if (Date.now() - lastTouchEndTime < GHOST_CLICK_THRESHOLD) return;

    const zone = getZone(e.clientX);
    if (zone === 'prev') handlePrev();
    else if (zone === 'next') handleNext();
    else toggleViewerUI();
  };

  // ── 터치 핸들러 ────────────────────────────────────────────────
  const onTouchStart = (e) => {
    if (currentView.value !== 'viewer') return;
    if (isUIElement(e.target)) {
      tracking = false;
      return;
    }

    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    tracking = true;
  };

  const onTouchMove = (e) => {
    if (!tracking) return;
    // 페이지 모드에서 수평 스와이프 시 브라우저 기본 스크롤 차단
    if (viewerData.mode !== 'scroll') {
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - touchStartX);
      const dy = Math.abs(t.clientY - touchStartY);
      if (dx > dy && dx > 10) e.preventDefault();
    }
  };

  const onTouchEnd = (e) => {
    lastTouchEndTime = Date.now(); // ghost click 방지 타임스탬프 갱신

    if (!tracking) return;
    tracking = false;

    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // 스크롤 모드: 탭만 처리 (스와이프는 브라우저 스크롤)
    if (viewerData.mode === 'scroll') {
      if (absDx < 10 && absDy < 10) toggleViewerUI();
      return;
    }

    // 페이지 모드: 수평 스와이프
    if (absDx > absDy && absDx > SWIPE_THRESHOLD) {
      if (dx < 0) handleNext();
      else handlePrev();
      return;
    }

    // 탭: 좌/중/우 영역 판별
    if (absDx < 10 && absDy < 10) {
      const zone = getZone(t.clientX);
      if (zone === 'prev') handlePrev();
      else if (zone === 'next') handleNext();
      else toggleViewerUI();
    }
  };

  // ── attach / detach ────────────────────────────────────────────
  let bound = false;
  // 현재 등록된 touchmove 핸들러의 passive 옵션 추적
  let currentTouchMovePassive = true;
  let stopWatchMode = null;

  /**
   * touchmove 리스너를 passive 옵션에 맞게 교체
   * - Page 모드: passive:false (수평 스와이프 시 preventDefault 필요)
   * - Scroll 모드: passive:true (iOS Safari 성능 보호)
   */
  const syncTouchMoveListener = (isScrollMode) => {
    if (!bound) return;
    const newPassive = isScrollMode;
    if (newPassive === currentTouchMovePassive) return; // 변화 없으면 교체 불필요
    document.removeEventListener('touchmove', onTouchMove);
    document.addEventListener('touchmove', onTouchMove, { passive: newPassive });
    currentTouchMovePassive = newPassive;
  };

  const attach = () => {
    if (bound) return;
    const isScrollMode = viewerData.mode === 'scroll';
    currentTouchMovePassive = isScrollMode;
    // mousedown: 데스크탑 클릭 처리
    document.addEventListener('mousedown', onMouseDown);
    // touch: 모바일 탭/스와이프 처리
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: isScrollMode });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    bound = true;

    // viewerData.mode 변경 시 touchmove passive 자동 동기화
    stopWatchMode = watch(
      () => viewerData.mode,
      (mode) => syncTouchMoveListener(mode === 'scroll'),
      { immediate: false }
    );
  };

  const detach = () => {
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    if (stopWatchMode) { stopWatchMode(); stopWatchMode = null; }
    bound = false;
  };

  return { attach, detach };
}
