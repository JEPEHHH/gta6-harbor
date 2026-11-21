// Traffic driver AI: NPC vehicles (sedans, taxis, vans, pickups, trucks, buses, SUVs)
// driving the road graph, indicating turns with blinking indicators, queuing neatly at
// red traffic lights, and avoiding the player and parked cars.

import { TAU, clamp, dist } from './util.js';
import { createVehicle, updateVehicle, vehicleCollision } from './vehicles.js';
import { randomNextEdge, laneOffset, isGreenFor } from './roads.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'taxi', 'van', 'pickup', 'suv', 'truck', 'bus', 'sports'];
const TRAFFIC_COLORS = ['#4482ae', '#c94a3a', '#6d8c5c', '#e8c840', '#965288', '#d68a3e', '#3c8878', '#c8ced6', '#4c5c74', '#e4e8ec'];

function pickTrafficColor(typeName, rng) {
  if (typeName === 'taxi') return '#f0c436';
  if (typeName === 'bus') return '#e4ecef';
  if (typeName === 'van') return rng() < 0.55 ? '#e2e7ec' : '#3a7d8c';
  if (typeName === 'pickup') return rng() < 0.5 ? '#b84c38' : '#3d6a8f';
  return TRAFFIC_COLORS[Math.floor(rng() * TRAFFIC_COLORS.length)];
}

function makeTrafficCar(edge, t, rng) {
  const dx = edge.to.x - edge.from.x;
  const dy = edge.to.y - edge.from.y;
  const lo = laneOffset(dx, dy, 1);
  const x = edge.from.x + dx * t + lo.ox;
  const y = edge.from.y + dy * t + lo.oy;
  const angle = Math.atan2(dy, dx);
  const typeName = TRAFFIC_TYPES[Math.floor(rng() * TRAFFIC_TYPES.length)];
  const car = createVehicle(x, y, angle, typeName);
  car.color = pickTrafficColor(typeName, rng);
  car.driver = 'traffic';
  const baseSpeed = typeName === 'bus' ? 70 : typeName === 'truck' ? 78 : 92;
  car.ai = {
    edge,
    progress: t,
    targetSpeed: baseSpeed + rng() * 48,
    waitTimer: 0,
    nextEdge: null,
  };
  return car;
}

/** Spawn a set of varied traffic vehicles already on the road graph. */
export function spawnTraffic(world, graph, rng, count = 26) {
  const cars = [];
  for (let n = 0; n < count; n += 1) {
    const edge = graph.edges[Math.floor(rng() * graph.edges.length)];
    if (!edge) continue;
    const t = 0.18 + rng() * 0.62;
    const x = edge.from.x + (edge.to.x - edge.from.x) * t;
    const y = edge.from.y + (edge.to.y - edge.from.y) * t;
    if (world.isWater(x, y)) continue;
    cars.push(makeTrafficCar(edge, t, rng));
  }
  return cars;
}

/** Update all traffic AI cars for one tick, including queuing at lights & turn indicators. */
export function updateTrafficAI(traffic, dt, world, graph, player, allVehicles, particles, rng) {
  for (const car of traffic) {
    const ai = car.ai;
    if (!ai || !ai.edge) continue;

    const edge = ai.edge;
    const dx = edge.to.x - edge.from.x;
    const dy = edge.to.y - edge.from.y;
    const edgeLen = Math.hypot(dx, dy) || 1;
    const dirX = dx / edgeLen;
    const dirY = dy / edgeLen;

    // Pre-select the next edge as we approach the intersection so turn indicators can blink
    if (ai.progress > 0.55 && !ai.nextEdge) {
      ai.nextEdge = randomNextEdge(graph, edge.to, edge, rng);
    }
    if (ai.progress > 0.55 && ai.nextEdge) {
      const ndx = ai.nextEdge.to.x - ai.nextEdge.from.x;
      const ndy = ai.nextEdge.to.y - ai.nextEdge.from.y;
      const nLen = Math.hypot(ndx, ndy) || 1;
      const cross = dirX * (ndy / nLen) - dirY * (ndx / nLen);
      car.blinker = cross < -0.35 ? -1 : cross > 0.35 ? 1 : 0;
    } else {
      car.blinker = 0;
    }

    // Lane offset: drive on the right side of the road
    const lo = laneOffset(dx, dy, 1);
    const lookAhead = clamp(ai.progress + 0.08, 0, 1);
    const targetX = edge.from.x + dx * lookAhead + lo.ox;
    const targetY = edge.from.y + dy * lookAhead + lo.oy;

    // Steer toward the lane position
    const toTargetX = targetX - car.x;
    const toTargetY = targetY - car.y;
    const targetAngle = Math.atan2(toTargetY, toTargetX);
    let angleDiff = targetAngle - car.angle;
    while (angleDiff > Math.PI) angleDiff -= TAU;
    while (angleDiff < -Math.PI) angleDiff += TAU;
    car.steer = clamp(angleDiff * 2.5, -1, 1);

    // Stop cleanly behind the crosswalk stop line on red/yellow lights
    let shouldStop = false;
    if (ai.progress > 0.72 && ai.progress < 0.89) {
      for (const light of graph.lights) {
        if (dist(edge.to.x, edge.to.y, light.x, light.y) < 12) {
          if (!isGreenFor(light, dirX, dirY)) {
            shouldStop = true;
          }
        }
      }
    }

    // Queue cleanly behind vehicles ahead in the same lane (creates realistic light queues)
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    let tooClose = false;
    const safeGap = (car.w * 0.5) + 46;
    for (const other of allVehicles) {
      if (other === car || other.driver === null) continue;
      const ox = other.x - car.x;
      const oy = other.y - car.y;
      const ahead = ox * fx + oy * fy;
      const lateral = Math.abs(-ox * fy + oy * fx);
      if (ahead > 4 && ahead < safeGap + other.w * 0.5 && lateral < 19) {
        tooClose = true;
        break;
      }
    }

    // Yield to player on foot
    if (!player.inCar) {
      const px = player.x - car.x;
      const py = player.y - car.y;
      const ahead = px * fx + py * fy;
      const lateral = Math.abs(-px * fy + py * fx);
      if (ahead > 4 && ahead < 58 && lateral < 20) {
        tooClose = true;
      }
    }

    if (shouldStop || tooClose) {
      car.throttle = 0;
      car.brake = 0.82;
    } else {
      const curSpeed = Math.hypot(car.vx, car.vy);
      car.throttle = curSpeed < ai.targetSpeed ? 0.55 : 0.1;
      car.brake = curSpeed > ai.targetSpeed * 1.28 ? 0.4 : 0;
    }

    // Advance progress along the edge
    const spd = Math.hypot(car.vx, car.vy);
    ai.progress += (spd * dt) / edgeLen;

    // Reached the end of the edge — transition to pre-selected nextEdge
    if (ai.progress >= 1.0) {
      const nextEdge = ai.nextEdge || randomNextEdge(graph, edge.to, edge, rng);
      if (nextEdge) {
        ai.edge = nextEdge;
        ai.progress = 0.0;
        ai.nextEdge = null;
      } else {
        ai.progress = 0.95;
      }
    }

    updateVehicle(car, dt, world, particles);
  }

  // Traffic-to-traffic collisions
  for (let i = 0; i < traffic.length; i += 1) {
    for (let j = i + 1; j < traffic.length; j += 1) {
      vehicleCollision(traffic[i], traffic[j]);
    }
  }
}

/** Remove traffic cars that are too far from the player or destroyed. */
export function cullTraffic(traffic, player, maxDist = 2200) {
  for (let i = traffic.length - 1; i >= 0; i -= 1) {
    const car = traffic[i];
    if (car.hp <= 0 || dist(car.x, car.y, player.x, player.y) > maxDist) {
      traffic.splice(i, 1);
    }
  }
}

/** Keep the traffic pool topped up by spawning varied vehicles off-screen. */
export function refillTraffic(traffic, world, graph, player, rng, target = 26) {
  if (traffic.length >= target) return;
  const needed = target - traffic.length;
  const farEdges = graph.edges.filter((e) => {
    const mx = (e.from.x + e.to.x) / 2;
    const my = (e.from.y + e.to.y) / 2;
    const d = dist(mx, my, player.x, player.y);
    return d > 750 && d < 2000 && !world.isWater(mx, my);
  });
  for (let n = 0; n < needed && farEdges.length > 0; n += 1) {
    const edge = farEdges[Math.floor(rng() * farEdges.length)];
    const t = 0.25 + rng() * 0.5;
    traffic.push(makeTrafficCar(edge, t, rng));
  }
}
