// Pure recording state machine for Screenly. main.js keeps the
// MediaRecorder and the streams; this module only decides which
// transitions are legal, so an illegal button press can never crash
// the recorder — it is simply refused with a reason.
//
// States: idle -> countdown -> recording -> paused -> recording ...
//        recording/paused -> stopped -> idle (ready to record again)
//        countdown -> idle (user cancels before capture starts)

export const STATES = ['idle', 'countdown', 'recording', 'paused', 'stopped'];

const TRANSITIONS = {
  idle: ['countdown', 'recording'],
  countdown: ['recording', 'idle'],
  recording: ['paused', 'stopped'],
  paused: ['recording', 'stopped'],
  stopped: ['idle'],
};

export function createRecorderState() {
  return { state: 'idle' };
}

export function canTransition(current, next) {
  const allowed = TRANSITIONS[current];
  return Array.isArray(allowed) && allowed.includes(next);
}

// Returns { ok: true, state } on success, or { ok: false, state, error }
// on an illegal transition. Never throws, never changes the input.
export function transition(currentState, nextState) {
  if (!TRANSITIONS[currentState]) {
    return { ok: false, state: currentState, error: `Unknown state "${currentState}"` };
  }
  if (!canTransition(currentState, nextState)) {
    return { ok: false, state: currentState, error: `Cannot go from ${currentState} to ${nextState}` };
  }
  return { ok: true, state: nextState };
}

// Convenience checks used by main.js to enable/disable buttons.
export function isLive(state) {
  return state === 'recording' || state === 'paused';
}

export function isRecording(state) {
  return state === 'recording';
}
