function salesScroller(editor: HTMLElement) {
  const form = editor.querySelector('form');
  return form && window.getComputedStyle(form).overflowY === 'auto' ? form : editor;
}

// Scroll only the editor, and only far enough to expose the focused field.
function scrollTarget(editor: HTMLElement, input: HTMLInputElement) {
  const viewport = window.visualViewport;
  const scroller = salesScroller(editor);
  const editorRect = scroller.getBoundingClientRect();
  const inputRect = input.getBoundingClientRect();
  const labelRect = input.parentElement?.getBoundingClientRect() || inputRect;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
  const footer = editor.querySelector<HTMLElement>('.sales-submit');
  const footerRect = footer?.getBoundingClientRect();
  const top = Math.max(editorRect.top + scroller.clientTop, viewportTop) + 12;
  let bottom = Math.min(editorRect.bottom, viewportBottom) - 12;
  // The sticky submit button overlays the scrollable content.
  if (footer && ['sticky', 'fixed'].includes(window.getComputedStyle(footer).position) && footerRect && footerRect.bottom > top && footerRect.top < bottom) {
    bottom = Math.min(bottom, footerRect.top - 12);
  }
  // Prefer showing the label too; in a very short viewport prioritize the input.
  const targetTop = labelRect.height <= bottom - top ? labelRect.top : inputRect.top;
  const delta = targetTop < top ? targetTop - top : inputRect.bottom > bottom ? inputRect.bottom - bottom : 0;
  return Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + delta));
}


type ScrollAnimation = { input: HTMLInputElement; frame: number };
const animations = new WeakMap<HTMLElement, ScrollAnimation>();

export function cancelSalesInputScroll(editor: HTMLElement) {
  const animation = animations.get(editor);
  if (animation) cancelAnimationFrame(animation.frame);
  animations.delete(editor);
}

export function revealSalesInput(editor: HTMLElement, input: HTMLInputElement, smooth = false) {
  const scroller = salesScroller(editor);
  const running = animations.get(editor);
  // Keyboard/viewport updates are incorporated into the running animation.
  if (running?.input === input && !smooth) return;
  cancelSalesInputScroll(editor);
  const target = scrollTarget(editor, input);
  if (Math.abs(target - scroller.scrollTop) <= 1) return;
  if (!smooth || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    scroller.scrollTo({ top: target, behavior: 'instant' });
    return;
  }
  const animation: ScrollAnimation = { input, frame: 0 };
  animations.set(editor, animation);
  const start = performance.now();
  let previous = start;
  const step = (now: number) => {
    if (!editor.isConnected || !input.isConnected || document.activeElement !== input) {
      cancelSalesInputScroll(editor);
      return;
    }
    // Recalculate the destination every frame as the mobile keyboard opens.
    const destination = scrollTarget(editor, input);
    const remaining = Math.max(16, 240 - (now - start));
    const fraction = Math.min(1, (now - previous) / remaining);
    scroller.scrollTo({ top: scroller.scrollTop + (destination - scroller.scrollTop) * fraction, behavior: 'instant' });
    previous = now;
    if (now - start >= 240 || Math.abs(destination - scroller.scrollTop) <= 1) {
      scroller.scrollTo({ top: destination, behavior: 'instant' });
      animations.delete(editor);
      // Keep keyboard activation from the original click, and confirm focus
      // after scrolling without introducing a second browser-driven jump.
      input.focus({ preventScroll: true });
      return;
    }
    animation.frame = requestAnimationFrame(step);
  };
  animation.frame = requestAnimationFrame(step);
}
