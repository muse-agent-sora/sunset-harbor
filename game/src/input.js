// Sunset Harbor — keyboard and mouse input. One shared object the game loop
// polls each frame; keys are tracked by their `code` so WASD and arrows both work,
// and the mouse reports canvas-relative position plus the aim angle from the
// player. Also exposes the "just pressed" edge for one-shot actions (E, F, P, M).
const keysDown = new Set();
const pressed = new Set();
let mouseX = 0;
let mouseY = 0;
let mouseDown = false;
let mouseClicked = false;
let canvasEl = null;

export const input = {
  get mouseX() { return mouseX; },
  get mouseY() { return mouseY; },
  get mouseDown() { return mouseDown; },
  /** True only on the frame the button went down. */
  get clicked() { return mouseClicked; },
  down(code) { return keysDown.has(code); },
  /** True only on the frame the key went down. */
  wasPressed(code) { return pressed.has(code); },
  /** Any of the given codes held. */
  any(...codes) { return codes.some((c) => keysDown.has(c)); },
  /** Clear the per-frame edges; call at the end of each update. */
  endFrame() {
    pressed.clear();
    mouseClicked = false;
  },
};

/** Attach listeners to a canvas. Call once at startup. */
export function attachInput(canvas) {
  canvasEl = canvas;
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keysDown.add(event.code);
    pressed.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keysDown.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keysDown.clear();
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    mouseDown = true;
    mouseClicked = true;
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

/** Aim angle from a world point toward the mouse, given the camera offset. */
export function aimAngle(worldX, worldY, camera) {
  const sx = worldX - camera.x;
  const sy = worldY - camera.y;
  return Math.atan2(mouseY - sy, mouseX - sx);
}
