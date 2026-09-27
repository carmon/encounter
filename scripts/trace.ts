// Print the chronicle of one auto-played encounter.  npm run trace -- scenario=haunt seed=3 [party=a,b,c]
import { playOut } from '../src/engine/autoplay';
import { buildOutput, createEncounter } from '../src/engine/encounter';
import { ROSTER } from '../src/content/roster';
import { SCENARIOS } from '../src/content/scenarios';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const scn = SCENARIOS.find((s) => s.id === (args.scenario ?? 'ford'))!;
const party = String(args.party ?? 'maren,ines,brannoc').split(',').map((id) => ROSTER.find((c) => c.id === id)!);
let st = createEncounter(scn, party, Number(args.seed ?? 1));
st = playOut(st);
for (const l of st.log.slice(-Number(args.tail ?? 60))) console.log(`R${l.round} ${l.kind.padEnd(4)} ${l.text}${l.delta ? `  [${l.delta}]` : ''}${l.roll ? `  (${l.roll})` : ''}`);
const o = buildOutput(st);
console.log('\n', o.outcome, o.success, `disp ${st.disposition} tension ${st.tension}`, o.objectives);
