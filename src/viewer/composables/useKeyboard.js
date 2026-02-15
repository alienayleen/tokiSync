import { onMounted, onUnmounted } from 'vue';
import { useStore } from './useStore';

/**
 * 키보드 단축키 composable
 * 리더 뷰에서만 동작하며, attach/detach로 생명주기를 제어합니다.
 */
export function useKeyboard() {
  const {
    currentView,
    handleNext, handlePrev,
    exitViewer, toggleViewerUI,
    goToNextEpisode, goToPrevEpisode,
    showEpisodeModal,
  } = useStore();

  const onKeyDown = (e) => {
    // 리더 뷰가 아니면 무시
    if (currentView.value !== 'viewer') return;

    // input/textarea에 포커스가 있으면 무시
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        handlePrev();
        break;

      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        handleNext();
        break;

      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        handlePrev();
        break;

      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        handleNext();
        break;

      case ' ': // Space
        e.preventDefault();
        handleNext();
        break;

      case 'Escape':
        e.preventDefault();
        if (showEpisodeModal.value) {
          showEpisodeModal.value = false;
        } else {
          exitViewer();
        }
        break;

      case 'f':
      case 'F':
        e.preventDefault();
        toggleViewerUI();
        break;

      case '[':
        e.preventDefault();
        goToPrevEpisode();
        break;

      case ']':
        e.preventDefault();
        goToNextEpisode();
        break;
    }
  };

  const attach = () => {
    window.addEventListener('keydown', onKeyDown);
  };

  const detach = () => {
    window.removeEventListener('keydown', onKeyDown);
  };

  return { attach, detach };
}
