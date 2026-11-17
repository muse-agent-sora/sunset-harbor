// Sunset Harbor — keyboard and mouse input.
// Keys are tracked by code in a live set; edge-triggered actions (press once)
// are collected into a queue that the game loop drains each frame, so a tap
// is never lost between frames and never fires twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_MUTE = 32;
export const ACTION_SIDE = 64;

const EDGE_KEYS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  KeyF: ACTION_PUNCH,
  KeyR: ACTION_RELOAD,
  KeyM: ACTION_MUTE,
  KeyT: ACTION_SIDE,
};

export function createInput(canvas) {
  const keys = new Set();
  let queued = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    const action = EDGE_KEYS[event.code];
    if (action !== undefined) queued |= action;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    if (event.button !== 0) return;
    mouse.down = true;
    mouse.clicked = true;
    onMouseMove(event);
  }
  function onMouseUp(event) {
    if (event.button !== 0) return;
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('blur', () => keys.clear());

  function down(...codes) {
    return codes.some((code) => keys.has(code));
  }

  return {
    mouse,
    isDown(code) {
      return keys.has(code);
    },
    // Held movement: -1, 0 or 1 on each axis (WASD or arrows).
    moveAxis() {
      const x = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
      const y = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
      return { x, y };
    },
    sprint() {
      return down('ShiftLeft', 'ShiftRight');
    },
    handbrake() {
      return down('Space');
    },
    accelerate() {
      return down('KeyW', 'ArrowUp');
    },
    brake() {
      return down('KeyS', 'ArrowDown');
    },
    steer() {
      return (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
    },
    shooting() {
      return mouse.down;
    },
    // Drain the edge-triggered actions pressed since the last call.
    takeActions() {
      const actions = queued;
      queued = 0;
      const clicked = mouse.clicked;
      mouse.clicked = false;
      return { actions, clicked };
    },
  };
}
