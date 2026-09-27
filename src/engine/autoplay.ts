import { autoChoice, autoRespond, npcChoice } from './ai';
import { currentStep, respond, step } from './encounter';
import type { EncounterState } from './types';

/** Play an encounter to the end with the autopilot on the player side. */
export function playOut(st: EncounterState, maxSteps = 600): EncounterState {
  for (let i = 0; i < maxSteps && st.outcome === 'ongoing'; i++) {
    if (st.pending) {
      st = respond(st, autoRespond(st));
      continue;
    }
    const s = currentStep(st);
    if (!s) break;
    st = step(st, s.side === 'player' ? autoChoice(st, s.actorId) : npcChoice(st, s.actorId));
  }
  return st;
}
