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

/** Draw traffic light indicators at intersections. */
export function drawLights(ctx, graph, view) {
  for (const l of graph.lights) {
    if (l.x < view.x - 40 || l.x > view.x + view.w + 40 ||
        l.y < view.y - 40 || l.y > view.y + view.h + 40) continue;
    const r = CITY.roadHalf + 4;
    // North-south indicator
    const nsColor = l.phase === 0 ? '#3ad05a' : l.phase === 1 ? '#e8d040' : '#d04040';
    ctx.fillStyle = nsColor;
    ctx.beginPath();
    ctx.arc(l.x + r, l.y - r, 3.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(l.x - r, l.y + r, 3.5, 0, TAU);
    ctx.fill();
    // East-west indicator
    const ewColor = l.phase === 2 ? '#3ad05a' : l.phase === 3 ? '#e8d040' : '#d04040';
    ctx.fillStyle = ewColor;
    ctx.beginPath();
    ctx.arc(l.x + r, l.y + r, 3.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(l.x - r, l.y - r, 3.5, 0, TAU);
    ctx.fill();
  }
}
