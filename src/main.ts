import { ROSTER } from './content/roster';
import { createEncounter } from './engine/encounter';
import { renderGame, type Session } from './ui/game';
import { renderSetup, type SetupState } from './ui/setup';
import './ui/style.css';

const root = document.getElementById('app')!;
const setup: SetupState = { scenario: null, picked: [] };

function toSetup() {
  setup.picked = [];
  renderSetup(root, setup, start);
}

function start(scenario: NonNullable<SetupState['scenario']>, picked: string[]) {
  const party = picked.map((id) => ROSTER.find((c) => c.id === id)!);
  const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  const session: Session = { st: createEncounter(scenario, party, seed), draft: new Map(), paused: false, timer: null, onExit: toSetup };
  renderGame(root, session);
}

toSetup();
