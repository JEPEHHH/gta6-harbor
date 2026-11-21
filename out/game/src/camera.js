// Follow camera with velocity lookahead, smooth pursuit, zoom per mode and decaying shake.

import { CAMERA } from './config.js';
import { clamp, damp } from './util.js';

export function createCamera(x, y) {
  const cam = {
    x, y,
    zoom: CAMERA.footZoom,
    sx: 0, sy: 0,          // shake offset applied to the view, not to the position
    shakeTime: 0,
    shakeDur: 1,
    shakeMag: 0,
  };

  cam.snap = (tx, ty) => {
    cam.x = tx;
    cam.y = ty;
    cam.sx = 0;
    cam.sy = 0;
  };

  cam.shake = (mag, dur = 0.4) => {
    cam.shakeMag = Math.max(cam.shakeMag, mag);
    cam.shakeTime = dur;
    cam.shakeDur = dur;
  };

  /** target: what to follow; vx/vy: its velocity, for lookahead. */
  cam.update = (dt, target, vx, vy, driving) => {
    const leadX = clamp(vx * CAMERA.lead, -CAMERA.maxLead, CAMERA.maxLead);
    const leadY = clamp(vy * CAMERA.lead, -CAMERA.maxLead, CAMERA.maxLead);
    cam.x = damp(cam.x, target.x + leadX, CAMERA.smooth, dt);
    cam.y = damp(cam.y, target.y + leadY, CAMERA.smooth, dt);
    cam.zoom = damp(cam.zoom, driving ? CAMERA.carZoom : CAMERA.footZoom, 3, dt);
    if (cam.shakeTime > 0) {
      cam.shakeTime -= dt;
      const k = Math.max(0, cam.shakeTime / cam.shakeDur);
      const m = cam.shakeMag * k * k;
      cam.sx = (Math.random() * 2 - 1) * m;
      cam.sy = (Math.random() * 2 - 1) * m;
      if (cam.shakeTime <= 0) cam.shakeMag = 0;
    } else {
      cam.sx = 0;
      cam.sy = 0;
    }
  };

  /** The world rectangle visible in a cssW x cssH window, with a culling margin. */
  cam.view = (cssW, cssH, margin = 80) => {
    const w = cssW / cam.zoom + margin * 2;
    const h = cssH / cam.zoom + margin * 2;
    return { x: cam.x - w / 2, y: cam.y - h / 2, w, h };
  };

  return cam;
}
