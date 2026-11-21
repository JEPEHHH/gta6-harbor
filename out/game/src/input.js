// Keyboard and mouse state. Held keys drive movement; one-shot presses are queued so a tap
// between two frames is never lost and never counted twice. The mouse aims in screen space.

export const KEYMAP = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyF'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'Space'],
  continue: ['KeyC'],
  horn: ['KeyH'],
  melee: ['KeyV'],
  radio: ['KeyR'],
  rain: ['KeyN'],
};

const HANDLED = new Set(Object.values(KEYMAP).flat());

export function createInput(canvas) {
  const held = new Set();
  const presses = new Set();
  const mouse = { x: 640, y: 360, down: false, pressed: false };

  window.addEventListener('keydown', (event) => {
    if (!HANDLED.has(event.code)) return;
    event.preventDefault();
    if (!event.repeat) presses.add(event.code);
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // Keys released while the tab is hidden never send keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      mouse.pressed = true;
    }
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function anyHeld(action) {
    return KEYMAP[action].some((code) => held.has(code));
  }

  return {
    /** Normalised WASD / arrow direction, length 0 or 1. */
    axis() {
      let x = (anyHeld('right') ? 1 : 0) - (anyHeld('left') ? 1 : 0);
      let y = (anyHeld('down') ? 1 : 0) - (anyHeld('up') ? 1 : 0);
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      return { x, y };
    },
    isDown: anyHeld,
    /** True once per physical press of any key bound to the action. */
    pressed(action) {
      let hit = false;
      for (const code of KEYMAP[action]) {
        if (presses.delete(code)) hit = true;
      }
      return hit;
    },
    endFrame() {
      presses.clear();
      mouse.pressed = false;
    },
    mouse,
    takeMousePress() {
      const hit = mouse.pressed;
      mouse.pressed = false;
      return hit;
    },
  };
}
