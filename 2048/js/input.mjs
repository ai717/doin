const KEYS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

const THRESHOLD = 26;

function isTyping(target) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA";
}

export function bindKeyboard(onMove, isOpen) {
  window.addEventListener("keydown", (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    const dir = KEYS[event.code];
    if (!dir || isTyping(event.target) || !isOpen()) return;
    event.preventDefault();
    onMove(dir);
  });
}

export function bindSwipe(element, onMove, isOpen) {
  let startX = 0;
  let startY = 0;
  let activeId = -1;

  element.addEventListener("pointerdown", (event) => {
    if (activeId !== -1) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button, a, .overlay")) return;
    activeId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best effort.
    }
  });

  element.addEventListener("pointerup", (event) => {
    if (event.pointerId !== activeId) return;
    activeId = -1;
    if (!isOpen()) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const flat = Math.abs(dx);
    const lift = Math.abs(dy);
    if (Math.max(flat, lift) < THRESHOLD) return;
    if (flat > lift) onMove(dx > 0 ? "right" : "left");
    else onMove(dy > 0 ? "down" : "up");
  });

  element.addEventListener("pointercancel", (event) => {
    if (event.pointerId === activeId) activeId = -1;
  });
}
