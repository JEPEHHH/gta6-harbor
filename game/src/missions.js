// Mission chain definitions and state machine for Blackwater Harbor.
// Three chained missions with objectives, dialogue, waypoints, escalating rewards,
// and a short epilogue when all three are complete.

import { dist } from './util.js';

const WAYPOINT_REACH = 50;

/** Mission definitions — three chained missions plus the epilogue. */
const CHAIN = [
  {
    id: 0,
    title: 'The Pickup',
    steps: [
      {
        objective: 'Drive to the docks — meet Marcus',
        waypoint: { x: 4500, y: 1180 },
        dialogue: null,
        trigger: 'reach',
      },
      {
        objective: 'Collect the package from the warehouse',
        waypoint: { x: 4520, y: 1340 },
        dialogue: 'Marcus: "Grab the crate from the back. Don\'t let anyone see you."',
        trigger: 'reach',
      },
      {
        objective: 'Bring the package to the safehouse in The Palms',
        waypoint: { x: 1710, y: 1500 },
        dialogue: 'Marcus: "Get this across town. No heat. I mean it."',
        trigger: 'reach',
      },
    ],
    reward: 2000,
    completionDialogue: 'Marcus: "Clean work. You\'ve got talent, kid. I\'ll be in touch."',
  },
  {
    id: 1,
    title: 'Heat Wave',
    steps: [
      {
        objective: 'Go to the Midtown parking garage',
        waypoint: { x: 2550, y: 1500 },
        dialogue: 'Marcus calls: "We need a fast car. The garage on Fifth has what we need."',
        trigger: 'reach',
      },
      {
        objective: 'Steal the sports car',
        waypoint: { x: 2600, y: 1480 },
        dialogue: 'Marcus: "Red one, second row. Hotwire it and drive to the docks."',
        trigger: 'reach',
      },
      {
        objective: 'Deliver the car to the container yard',
        waypoint: { x: 4500, y: 2100 },
        dialogue: null,
        trigger: 'reach',
      },
      {
        objective: 'Lose the heat — wanted level must reach zero',
        waypoint: null,
        dialogue: 'Marcus: "They\'re on to you! Shake them off, then lay low."',
        trigger: 'lose_wanted',
      },
    ],
    reward: 4000,
    completionDialogue: 'Marcus: "That car\'s worth a fortune overseas. You earned this."',
  },
  {
    id: 2,
    title: 'The Score',
    steps: [
      {
        objective: 'Meet Marcus at the harbor basin bridge',
        waypoint: { x: 4280, y: 1540 },
        dialogue: 'Marcus: "This is the big one. A boat is docking tonight. We hit the cargo."',
        trigger: 'reach',
      },
      {
        objective: 'Clear the docks — eliminate the guards',
        waypoint: { x: 4540, y: 1800 },
        dialogue: 'Marcus: "Take out anyone who gets in the way. This is all or nothing."',
        trigger: 'reach',
      },
      {
        objective: 'Grab the cargo from pier two',
        waypoint: { x: 4740, y: 2560 },
        dialogue: null,
        trigger: 'reach',
      },
      {
        objective: 'Escape to the beach safehouse',
        waypoint: { x: 1800, y: 3300 },
        dialogue: 'Marcus: "Go go go! Cops are everywhere!"',
        trigger: 'reach',
      },
    ],
    reward: 8000,
    completionDialogue: 'Marcus: "We did it. The harbor is ours now."',
  },
];

const EPILOGUE_TEXT = 'The harbor belongs to you. Sun, speed and salt air — Blackwater Harbor, conquered.';

/** Create the mission system state. */
export function createMissionState() {
  return {
    chainIndex: 0,     // which mission in the chain (0–2), 3 = epilogue done
    stepIndex: 0,      // current step within the active mission
    active: false,     // is a mission currently active?
    completed: [],     // IDs of completed missions
    dialogue: null,    // current dialogue text to show
    dialogueTimer: 0,  // how long the dialogue has been visible
    epilogueDone: false,
    missionJustCompleted: false,
  };
}

/** Start the next mission in the chain or the epilogue. */
export function startNextMission(ms) {
  if (ms.chainIndex >= CHAIN.length) {
    // All missions done — trigger epilogue
    ms.active = false;
    ms.epilogueDone = true;
    ms.dialogue = EPILOGUE_TEXT;
    ms.dialogueTimer = 0;
    return null;
  }
  ms.stepIndex = 0;
  ms.active = true;
  ms.missionJustCompleted = false;
  const mission = CHAIN[ms.chainIndex];
  const step = mission.steps[0];
  if (step.dialogue) {
    ms.dialogue = step.dialogue;
    ms.dialogueTimer = 0;
  }
  return mission;
}

/** Start a specific mission by index (0-based). */
export function startMissionByIndex(ms, index) {
  if (index < 0 || index >= CHAIN.length) return null;
  ms.chainIndex = index;
  return startNextMission(ms);
}

/** Get the current mission definition, or null. */
export function currentMission(ms) {
  if (!ms.active || ms.chainIndex >= CHAIN.length) return null;
  return CHAIN[ms.chainIndex];
}

/** Get the current step of the active mission. */
export function currentStep(ms) {
  const m = currentMission(ms);
  if (!m || ms.stepIndex >= m.steps.length) return null;
  return m.steps[ms.stepIndex];
}

/** Get the current objective text. */
export function currentObjective(ms) {
  const step = currentStep(ms);
  if (step) return step.objective;
  if (ms.epilogueDone) return EPILOGUE_TEXT;
  if (ms.missionJustCompleted) {
    const m = CHAIN[ms.chainIndex];
    return m ? m.completionDialogue : '';
  }
  return 'Explore the harbor — find a ride and make a name';
}

/** Get the current waypoint, or null. */
export function currentWaypoint(ms) {
  const step = currentStep(ms);
  return step ? step.waypoint : null;
}

/**
 * Update the mission system each tick.
 * Returns an object with events: { advanced, completed, reward, notification, raiseWanted }
 */
export function updateMissions(ms, dt, player, wanted) {
  const result = { advanced: false, completed: false, reward: 0, notification: null, raiseWanted: 0 };

  // Dialogue timer
  if (ms.dialogue) {
    ms.dialogueTimer += dt;
    if (ms.dialogueTimer > 8) {
      ms.dialogue = null;
    }
  }

  if (!ms.active) return result;

  const mission = currentMission(ms);
  const step = currentStep(ms);
  if (!mission || !step) return result;

  // Check step completion
  let complete = false;
  if (step.trigger === 'reach' && step.waypoint) {
    complete = dist(player.x, player.y, step.waypoint.x, step.waypoint.y) < WAYPOINT_REACH;
  } else if (step.trigger === 'lose_wanted') {
    complete = wanted === 0;
  }

  if (complete) {
    ms.stepIndex += 1;
    result.advanced = true;

    if (ms.stepIndex >= mission.steps.length) {
      // Mission complete
      ms.completed.push(mission.id);
      ms.active = false;
      ms.missionJustCompleted = true;
      result.completed = true;
      result.reward = mission.reward;
      result.notification = `Mission Complete: ${mission.title} — $${mission.reward.toLocaleString()}`;
      ms.dialogue = mission.completionDialogue;
      ms.dialogueTimer = 0;
      ms.chainIndex += 1;
    } else {
      // Next step
      const nextStep = mission.steps[ms.stepIndex];
      result.notification = nextStep.objective;
      if (nextStep.trigger === 'lose_wanted') {
        result.raiseWanted = 2;
      }
      if (nextStep.dialogue) {
        ms.dialogue = nextStep.dialogue;
        ms.dialogueTimer = 0;
      }
    }
  }

  return result;
}

/** Get mission data for saving. */
export function saveMissionData(ms) {
  return {
    chainIndex: ms.chainIndex,
    stepIndex: ms.stepIndex,
    active: ms.active,
    completed: [...ms.completed],
    epilogueDone: ms.epilogueDone,
  };
}

/** Restore mission data from a save. */
export function loadMissionData(ms, data) {
  if (!data) return;
  ms.chainIndex = data.chainIndex ?? 0;
  ms.stepIndex = data.stepIndex ?? 0;
  ms.active = data.active ?? false;
  ms.completed = data.completed ?? [];
  ms.epilogueDone = data.epilogueDone ?? false;
}

/** Get the chain length. */
export function missionCount() {
  return CHAIN.length;
}

/** Get mission title by index. */
export function missionTitle(index) {
  if (index >= 0 && index < CHAIN.length) return CHAIN[index].title;
  return 'Epilogue';
}
