// Road graph, lanes, traffic lights and path-following helpers.
// Traffic AI and police use this to navigate; pedestrians use the sidewalk edges.

import { CITY } from './config.js';
import { TAU, clamp } from './util.js';

/** Build an intersection graph from the world's road arrays. */
export function buildRoadGraph(world) {
  const nodes = [];
  const edges = [];
  const lights = [];

  // Every crossing of a vertical and a horizontal road is a node.
  for (let i = 0; i < world.roadsV.length; i += 1) {
    for (let j = 0; j < world.roadsH.length; j += 1) {
      const x = world.roadsV[i];
      const y = world.roadsH[j];
      if (world.isWater(x, y)) continue;
      nodes.push({ id: nodes.length, x, y, i, j });
    }
  }

  function findNode(i, j) {
    return nodes.find((n) => n.i === i && n.j === j) ?? null;
  }

  // Horizontal edges (along each roadsH).
  for (let j = 0; j < world.roadsH.length; j += 1) {
    for (let i = 0; i < world.roadsV.length - 1; i += 1) {
      const a = findNode(i, j);
      const b = findNode(i + 1, j);
      if (a && b) {
        edges.push({ from: a, to: b, len: Math.abs(b.x - a.x) });
        edges.push({ from: b, to: a, len: Math.abs(b.x - a.x) });
      }
    }
  }

  // Vertical edges (along each roadsV).
  for (let i = 0; i < world.roadsV.length; i += 1) {
    for (let j = 0; j < world.roadsH.length - 1; j += 1) {
      const a = findNode(i, j);
      const b = findNode(i, j + 1);
      if (a && b) {
        edges.push({ from: a, to: b, len: Math.abs(b.y - a.y) });
        edges.push({ from: b, to: a, len: Math.abs(b.y - a.y) });
      }
    }
  }

  // Traffic lights at every node with >= 3 edges.
  for (const n of nodes) {
    const count = edges.filter((e) => e.from === n || e.to === n).length;
    if (count >= 4) {
      lights.push({
        x: n.x,
        y: n.y,
        node: n,
        phase: 0,
        timer: 0,
        greenDuration: 8 + (n.id % 4),   // slight variation
        yellowDuration: 2,
      });
    }
  }

  return { nodes, edges, lights };
}

/** Advance traffic light timers. phase 0 = NS green, 1 = NS yellow, 2 = EW green, 3 = EW yellow */
export function updateLights(graph, dt) {
  for (const l of graph.lights) {
    l.timer += dt;
    const dur = l.phase % 2 === 0 ? l.greenDuration : l.yellowDuration;
    if (l.timer >= dur) {
      l.timer -= dur;
      l.phase = (l.phase + 1) % 4;
    }
  }
}

/** Is the light green for a vehicle heading in direction (dx, dy)? */
export function isGreenFor(light, dx, dy) {
  const nsMoving = Math.abs(dy) > Math.abs(dx);
  if (nsMoving) return light.phase === 0;         // NS green
  return light.phase === 2;                        // EW green
}

/** Is it yellow (warning) for a vehicle heading in direction (dx, dy)? */
export function isYellowFor(light, dx, dy) {
  const nsMoving = Math.abs(dy) > Math.abs(dx);
  if (nsMoving) return light.phase === 1;
  return light.phase === 3;
}

/** Pick a random next edge from a node, optionally excluding an edge we arrived on. */
export function randomNextEdge(graph, node, fromEdge, rng) {
  const candidates = graph.edges.filter(
    (e) => e.from === node && (!fromEdge || e.to !== fromEdge.from)
  );
  if (candidates.length === 0) {
    return graph.edges.find((e) => e.from === node) ?? null;
  }
  return candidates[Math.floor(rng() * candidates.length)];
}

/** Find the nearest graph node to a world position. */
export function nearestNode(graph, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const n of graph.nodes) {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

/** Lane offset: traffic drives on the right, so offset perpendicular to direction. */
export function laneOffset(dx, dy, lane = 1) {
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return { ox: nx * CITY.roadHalf * 0.5 * lane, oy: ny * CITY.roadHalf * 0.5 * lane };
}

/** Draw traffic lights mounted on corner poles with overhanging mast arms & signal heads. */
export function drawLights(ctx, graph, view, night = 0, sun = null) {
  const sdx = sun ? sun.dx * 22 : 5;
  const sdy = sun ? sun.dy * 22 : 4;
  const shA = sun ? sun.alpha * 0.85 : 0.20;

  for (const l of graph.lights) {
    if (l.x < view.x - 56 || l.x > view.x + view.w + 56 ||
        l.y < view.y - 56 || l.y > view.y + view.h + 56) continue;
    const r = CITY.roadHalf + 6;
    // Active light states (0=green, 1=yellow, 2=red)
    const nsIdx = l.phase === 0 ? 0 : l.phase === 1 ? 1 : 2;
    const ewIdx = l.phase === 2 ? 0 : l.phase === 3 ? 1 : 2;
    const cols = ['#3ee06a', '#f2cf44', '#eb3f3f'];
    const nsCol = cols[nsIdx];
    const ewCol = cols[ewIdx];

    // Four corner poles with mast arms cantilevered slightly over each approaching lane
    const corners = [
      { px: l.x + r, py: l.y - r, ax: -14, ay: 0, col: nsCol, idx: nsIdx, horiz: true },
      { px: l.x - r, py: l.y + r, ax: 14, ay: 0, col: nsCol, idx: nsIdx, horiz: true },
      { px: l.x + r, py: l.y + r, ax: 0, ay: -14, col: ewCol, idx: ewIdx, horiz: false },
      { px: l.x - r, py: l.y - r, ax: 0, ay: 14, col: ewCol, idx: ewIdx, horiz: false },
    ];

    for (const c of corners) {
      const hx = c.px + c.ax;
      const hy = c.py + c.ay;

      // Pole & cantilevered arm shadow on pavement
      ctx.strokeStyle = `rgba(14, 20, 36, ${shA.toFixed(3)})`;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(c.px, c.py);
      ctx.lineTo(c.px + sdx, c.py + sdy);
      ctx.lineTo(c.px + sdx + c.ax * 0.85, c.py + sdy + c.ay * 0.85);
      ctx.stroke();

      // Corner pole base + steel mast
      ctx.fillStyle = '#2d333c';
      ctx.beginPath();
      ctx.arc(c.px, c.py, 3.0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#4c5664';
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(c.px, c.py);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      // Yellow-black 3-lens signal head housing on the arm
      ctx.save();
      ctx.translate(hx, hy);
      if (!c.horiz) ctx.rotate(Math.PI * 0.5);
      ctx.fillStyle = '#1b1f26';
      ctx.beginPath();
      ctx.roundRect(-6.5, -3.2, 13, 6.4, 1.8);
      ctx.fill();
      ctx.strokeStyle = '#d4a632';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Three lenses (red, amber, green) — active one bright, inactive dim
      const lxPos = [-3.6, 0, 3.6];
      const lCols = ['#eb3f3f', '#f2cf44', '#3ee06a'];
      const activeSlot = c.idx === 2 ? 0 : c.idx === 1 ? 1 : 2;
      for (let k = 0; k < 3; k += 1) {
        ctx.fillStyle = k === activeSlot ? lCols[k] : 'rgba(60, 68, 78, 0.55)';
        ctx.beginPath();
        ctx.arc(lxPos[k], 0, k === activeSlot ? 1.8 : 1.2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();

      // Mild highlight bloom ONLY at dusk/night
      if (night > 0.18) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(hx, hy, 1, hx, hy, 13);
        g.addColorStop(0, c.col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.32 * night;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx, hy, 13, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}
