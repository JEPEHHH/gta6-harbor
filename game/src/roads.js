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

/** Draw overhead traffic signal housings with glowing red/amber/green lenses. */
export function drawLights(ctx, graph, view, night = 0) {
  for (const l of graph.lights) {
    if (l.x < view.x - 40 || l.x > view.x + view.w + 40 ||
        l.y < view.y - 40 || l.y > view.y + view.h + 40) continue;
    const r = CITY.roadHalf + 5;
    const nsColor = l.phase === 0 ? '#3ee06a' : l.phase === 1 ? '#f2cf44' : '#eb3f3f';
    const ewColor = l.phase === 2 ? '#3ee06a' : l.phase === 3 ? '#f2cf44' : '#eb3f3f';
    const pts = [
      [l.x + r, l.y - r, nsColor],
      [l.x - r, l.y + r, nsColor],
      [l.x + r, l.y + r, ewColor],
      [l.x - r, l.y - r, ewColor],
    ];
    for (const [px, py, col] of pts) {
      ctx.fillStyle = '#20242c';
      ctx.beginPath();
      ctx.arc(px, py, 5.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, TAU);
      ctx.fill();
      if (night > 0.15) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.25 * night;
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}
