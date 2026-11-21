// Traffic driver AI: NPC cars that drive the road graph, obey traffic lights,
// avoid the player and each other. One job: move traffic cars along roads.

import { CITY } from './config.js';
import { TAU, clamp, dist } from './util.js';
import { createVehicle, updateVehicle, vehicleCollision } from './vehicles.js';
import { nearestNode, randomNextEdge, laneOffset, isGreenFor } from './roads.js';

/** Spawn a set of traffic cars already on the road graph. */
export function spawnTraffic(world, graph, rng, count = 14) {
  const cars = [];
  for (let n = 0; n < count; n += 1) {
    const edge = graph.edges[Math.floor(rng() * graph.edges.length)];
    if (!edge) continue;
    const t = 0.2 + rng() * 0.6;
    const x = edge.from.x + (edge.to.x - edge.from.x) * t;
    const y = edge.from.y + (edge.to.y - edge.from.y) * t;
    const angle = Math.atan2(edge.to.y - edge.from.y, edge.to.x - edge.from.x);
    if (world.isWater(x, y)) continue;
    const typeNames = ['sedan', 'suv', 'truck', 'taxi'];
    const typeName = typeNames[Math.floor(rng() * typeNames.length)];
    const car = createVehicle(x, y, angle, typeName);
    const colors = ['#4a8ab5', '#c94a3a', '#8a9a6a', '#e8c840', '#a05a9a', '#d09848', '#5a8a5a', '#c0c0c8', '#6a7a9a'];
    car.color = colors[Math.floor(rng() * colors.length)];
    car.driver = 'traffic';
    car.ai = {
      edge,
      progress: t,
      targetSpeed: 80 + rng() * 60,
      waitTimer: 0,
      nextEdge: null,
    };
    cars.push(car);
  }
  return cars;
}

/** Update all traffic AI cars for one tick. */
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

    // Lane offset: drive on the right side of the road
    const lo = laneOffset(dx, dy, 1);
    const targetX = edge.from.x + dx * ai.progress + lo.ox;
    const targetY = edge.from.y + dy * ai.progress + lo.oy;

    // Steer toward the lane position
    const toTargetX = targetX - car.x;
    const toTargetY = targetY - car.y;
    const targetAngle = Math.atan2(toTargetY, toTargetX);
    let angleDiff = targetAngle - car.angle;
    while (angleDiff > Math.PI) angleDiff -= TAU;
    while (angleDiff < -Math.PI) angleDiff += TAU;
    car.steer = clamp(angleDiff * 2.5, -1, 1);

    // Check for red lights ahead
    let shouldStop = false;
    if (ai.progress > 0.75) {
      for (const light of graph.lights) {
        if (dist(edge.to.x, edge.to.y, light.x, light.y) < 10) {
          if (!isGreenFor(light, dirX, dirY)) {
            shouldStop = true;
          }
        }
      }
    }

    // Check distance to player vehicle and other traffic
    let tooClose = false;
    for (const other of allVehicles) {
      if (other === car || other.driver === null) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 60) {
        // Is the other car ahead of us?
        const aheadDot = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
        if (aheadDot > 0) tooClose = true;
      }
    }

    // Check distance to player on foot (avoid running them over)
    if (!player.inCar) {
      const dPlayer = dist(car.x, car.y, player.x, player.y);
      if (dPlayer < 55) {
        const aheadDot = (player.x - car.x) * Math.cos(car.angle) + (player.y - car.y) * Math.sin(car.angle);
        if (aheadDot > 0) tooClose = true;
      }
    }

    if (shouldStop || tooClose) {
      car.throttle = 0;
      car.brake = 0.6;
    } else {
      const curSpeed = Math.hypot(car.vx, car.vy);
      car.throttle = curSpeed < ai.targetSpeed ? 0.5 : 0.1;
      car.brake = curSpeed > ai.targetSpeed * 1.3 ? 0.4 : 0;
    }

    // Advance progress along the edge
    const spd = Math.hypot(car.vx, car.vy);
    ai.progress += (spd * dt) / edgeLen;

    // Reached the end of the edge — pick a new one
    if (ai.progress >= 1.0) {
      const nextEdge = randomNextEdge(graph, edge.to, edge, rng);
      if (nextEdge) {
        ai.edge = nextEdge;
        ai.progress = 0.0;
      } else {
        ai.progress = 0.95; // dead end, stay put
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

/** Keep the traffic pool topped up by spawning new cars off-screen. */
export function refillTraffic(traffic, world, graph, player, rng, target = 14) {
  if (traffic.length >= target) return;
  const needed = target - traffic.length;
  // Spawn at edges far from player
  const farEdges = graph.edges.filter((e) => {
    const mx = (e.from.x + e.to.x) / 2;
    const my = (e.from.y + e.to.y) / 2;
    const d = dist(mx, my, player.x, player.y);
    return d > 800 && d < 2000 && !world.isWater(mx, my);
  });
  for (let n = 0; n < needed && farEdges.length > 0; n += 1) {
    const edge = farEdges[Math.floor(rng() * farEdges.length)];
    const t = 0.3 + rng() * 0.4;
    const x = edge.from.x + (edge.to.x - edge.from.x) * t;
    const y = edge.from.y + (edge.to.y - edge.from.y) * t;
    const angle = Math.atan2(edge.to.y - edge.from.y, edge.to.x - edge.from.x);
    const typeNames = ['sedan', 'suv', 'truck', 'taxi'];
    const typeName = typeNames[Math.floor(rng() * typeNames.length)];
    const car = createVehicle(x, y, angle, typeName);
    const colors = ['#4a8ab5', '#c94a3a', '#8a9a6a', '#e8c840', '#a05a9a', '#d09848', '#5a8a5a', '#c0c0c8'];
    car.color = colors[Math.floor(rng() * colors.length)];
    car.driver = 'traffic';
    car.ai = {
      edge,
      progress: t,
      targetSpeed: 80 + rng() * 60,
      waitTimer: 0,
      nextEdge: null,
    };
    traffic.push(car);
  }
}
