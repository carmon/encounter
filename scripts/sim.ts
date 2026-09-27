// Headless balance run: autopilot plays the player side, npcChoice the NPC side.
// Usage: npm run sim [-- runs=400 scenario=haunt party=maren,ines,brannoc]
import { playOut } from '../src/engine/autoplay';
import { buildOutput, createEncounter } from '../src/engine/encounter';
import { ROSTER, PARTY_SIZE } from '../src/content/roster';
import { SCENARIOS } from '../src/content/scenarios';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const runs = Number(args.runs ?? 400);

function randomParty(seed: number) {
  const pool = [...ROSTER];
  let s = seed;
  const out = [];
  for (let i = 0; i < PARTY_SIZE; i++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    out.push(pool.splice((s >>> 8) % pool.length, 1)[0]);
  }
  return out;
}

for (const scn of SCENARIOS.filter((s) => !args.scenario || s.id === args.scenario)) {
  const outcomes: Record<string, number> = {};
  const rounds: number[] = [];
  let success = 0, stuck = 0, transfersChar = 0;
  for (let r = 0; r < runs; r++) {
    const seed = (r + 1) * 2654435761;
    const party = args.party ? String(args.party).split(',').map((id) => ROSTER.find((c) => c.id === id)!) : randomParty(seed);
    const st = playOut(createEncounter(scn, party, seed));
    if (st.outcome === 'ongoing') { stuck++; continue; }
    const out = buildOutput(st);
    outcomes[out.outcome] = (outcomes[out.outcome] ?? 0) + 1;
    rounds.push(out.rounds);
    if (out.success) success++;
    if (out.transfers.some((t) => t.kind === 'character')) transfersChar++;
  }
  rounds.sort((a, b) => a - b);
  const pct = (n: number) => `${((100 * n) / runs).toFixed(0)}%`;
  console.log(`\n${scn.name}  (${runs} runs)`);
  for (const [k, v] of Object.entries(outcomes).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(9)} ${pct(v).padStart(4)}`);
  console.log(`  success ${pct(success)} · median rounds ${rounds[rounds.length >> 1] ?? '-'} · char transfers ${pct(transfersChar)} · stuck ${stuck}`);
}
