import type {
  Character,
  Ending,
  GroupState,
  LogEvent,
  NpcAction,
  Order,
  ParleyState,
  PlanStep,
  PlayerAction,
  RollOpts,
} from './types';
import {
  affinityMod,
  groupSharesLanguage,
  partySharesLanguageWith,
} from './affinity';
import type { ScenarioDef } from '../data/scenarios';
import { renderLog, type LogKey, type MsgParams } from './messages';

const LEADER_ONLY: PlayerAction[] = [
  'rally',
  'coordinatedThreat',
  'finalOffer',
  'withdraw',
];

function nextRoll(state: ParleyState, opts?: RollOpts): number {
  if (opts?.dice && opts.dice.length > 0) {
    return opts.dice.shift() as number;
  }
  state.rngState = (Math.imul(state.rngState, 1103515245) + 12345) >>> 0;
  return ((state.rngState >>> 8) % 6) + 1;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function log(s: ParleyState, kind: LogEvent['kind'], key: LogKey, params?: MsgParams, delta?: string): void {
  s.log.push({ round: s.round, key, params, text: renderLog('en', key, params), kind, delta });
}

function end(s: ParleyState, ending: Ending, key: LogKey, params?: MsgParams, delta?: string): void {
  s.ended = ending;
  log(s, 'end', key, params, delta);
}

function stanceShift(s: ParleyState, delta: number, allowAlliance = false): void {
  s.stance = clamp(s.stance + delta, 0, allowAlliance ? 4 : 3);
}

export function memberOf(g: GroupState, id: string): Character | undefined {
  return g.members.find((m) => m.id === id);
}

function nameOf(s: ParleyState, id: string): string {
  return memberOf(s.player, id)?.name ?? memberOf(s.npc, id)?.name ?? id;
}

export function playerLeader(s: ParleyState): Character {
  const m = memberOf(s.player, s.player.order[0]);
  if (!m) throw new Error('no player leader');
  return m;
}

export function npcLeader(s: ParleyState): Character {
  const m = memberOf(s.npc, s.npc.order[0]);
  if (!m) throw new Error('no npc leader');
  return m;
}

function aliveList(g: GroupState): Character[] {
  return g.members.filter((m) => m.morale > 0);
}

function leaderMod(s: ParleyState): number {
  const l = playerLeader(s);
  return l.morale > 0 ? Math.min(2, Math.floor(l.skills.leadership / 2)) : 0;
}

export function canParley(s: ParleyState): boolean {
  if (s.player.interpreterId) {
    const interp = memberOf(s.player, s.player.interpreterId);
    return !!interp && interp.morale > 0;
  }
  return partySharesLanguageWith(aliveList(s.player), aliveList(s.npc));
}

function socialBlocked(s: ParleyState, _actor: Character): LogKey | null {
  if (canParley(s)) return null;
  if (s.speech === 'beasts') {
    return 'blocked.beasts';
  }
  return 'blocked.tongues';
}

function commsPenalty(s: ParleyState, actor: Character): number {
  if (canParley(s) && s.player.interpreterId && !groupSharesLanguage(actor, aliveList(s.npc))) return -1;
  return 0;
}

function gkey(holder: string, target: string): string {
  return `${holder}>${target}`;
}

function grudgeOf(s: ParleyState, holderId: string, targetId: string): number {
  return s.grudges[gkey(holderId, targetId)] ?? 0;
}

function revengeBonus(s: ParleyState, holderId: string, targetId: string): number {
  return grudgeOf(s, holderId, targetId) > 0 ? 1 : 0;
}

function noteGrudge(s: ParleyState, holderId: string, targetId: string): void {
  if (holderId === targetId) return;
  const k = gkey(holderId, targetId);
  const had = s.grudges[k] ?? 0;
  s.grudges[k] = had + 1;
  if (had === 0) {
    const h = nameOf(s, holderId);
    const t = nameOf(s, targetId);
    const npcHolder = !!memberOf(s.npc, holderId);
    log(
      s,
      npcHolder ? 'bad' : 'good',
      npcHolder ? 'feud.npc' : 'feud.player',
      { h, t },
      `feud: ${h} ⚔ ${t}`,
    );
  }
}

function opposedCheck(
  s: ParleyState,
  atk: number,
  def: number,
  opts?: RollOpts,
): number {
  const a = atk + nextRoll(s, opts);
  const d = def + nextRoll(s, opts);
  return a - d;
}

function applyMoraleToSide(g: GroupState, delta: number): void {
  for (const m of g.members) {
    if (m.morale > 0) m.morale = clamp(m.morale + delta, 0, 10);
  }
}

function bestSuccessor(g: GroupState, fallenId: string): Character | undefined {
  return aliveList(g)
    .filter((m) => m.id !== fallenId)
    .sort((a, b) => b.skills.leadership - a.skills.leadership)[0];
}

function checkLeaderDown(s: ParleyState, g: GroupState, opts?: RollOpts): void {
  const leaderId = g.order[0];
  const leader = memberOf(g, leaderId);
  if (!leader || leader.morale > 0) return;
  if (s.leaderDownRolled.includes(leaderId)) return;
  s.leaderDownRolled.push(leaderId);
  const succ = bestSuccessor(g, leaderId);
  if (!succ) return;
  const playerSide = !!memberOf(s.player, leaderId);
  const threshold = clamp(6 - succ.skills.leadership, 0, 6);
  const roll = nextRoll(s, opts);
  if (roll <= threshold) {
    if (playerSide) {
      end(s, 'routed', 'end.routed', { leader: leader.name });
    } else {
      end(s, 'victory', 'end.leaderRout', { leader: leader.name });
    }
  } else {
    g.order = [succ.id, ...g.order.filter((id) => id !== succ.id)];
    log(
      s,
      playerSide ? 'good' : 'info',
      playerSide ? 'leader.falls.player' : 'leader.falls.npc',
      { leader: leader.name, succ: succ.name, ldr: succ.skills.leadership },
    );
  }
}

function checkBreaks(s: ParleyState, opts?: RollOpts): void {
  if (s.ended !== 'ongoing') return;
  checkLeaderDown(s, s.npc, opts);
  if (s.ended !== 'ongoing') return;
  const npcBroken = s.npc.members.filter((m) => m.morale <= 0).length;
  if (npcBroken >= s.goal.breaksToFlee) {
    end(s, 'victory', 'end.victoryBreaks');
    return;
  }
  checkLeaderDown(s, s.player, opts);
  if (s.ended !== 'ongoing') return;
  if (aliveList(s.player).length === 0) {
    end(s, 'defeat', 'end.defeat');
  }
}

function startRound(s: ParleyState): void {
  s.stepCursor = 0;
  s.combatRound = s.standoff;
  const entries: Array<PlanStep & { initiative: number; order: number }> = [];
  let order = 0;
  for (const [side, group] of [['player', s.player], ['npc', s.npc]] as const) {
    for (const id of group.order) {
      const actor = memberOf(group, id);
      if (actor && actor.morale > 0) {
        entries.push({ side, actorId: id, initiative: s.initiative[id] ?? 2, order: order++ });
      }
    }
  }
  const sorted = entries
    .sort((a, b) => b.initiative - a.initiative || a.order - b.order)
    .map(({ side, actorId }) => ({ side, actorId }));
  if (s.round === 1) {
    const pLeader = s.player.order[0];
    const nLeader = s.npc.order[0];
    const opened = new Set([pLeader, nLeader]);
    const leaders: PlanStep[] = [];
    if ((memberOf(s.player, pLeader)?.morale ?? 0) > 0) leaders.push({ side: 'player', actorId: pLeader });
    if ((memberOf(s.npc, nLeader)?.morale ?? 0) > 0) leaders.push({ side: 'npc', actorId: nLeader });
    s.plan = [...leaders, ...sorted.filter((p) => !opened.has(p.actorId))];
    return;
  }
  s.plan = sorted;
}

export function createParley(
  scenario: ScenarioDef,
  partyIdsInOrder: string[],
  seed: number,
): ParleyState {
  const party = partyIdsInOrder
    .map((id) => scenario.roster.find((c) => c.id === id))
    .filter((c): c is Character => !!c)
    .map((c) => ({ ...c, skills: { ...c.skills } }));
  const npcs = scenario.npcs.map((c) => ({ ...c, skills: { ...c.skills } }));
  const s: ParleyState = {
    speech: scenario.speech,
    round: 1,
    patience: scenario.patience,
    stance: scenario.stance,
    trust: 0,
    player: {
      members: party,
      order: [...partyIdsInOrder],
      resources: scenario.resources,
      armed: false,
      escapeReady: false,
      interpreterId: null,
      goodsTaken: 0,
    },
    npc: {
      members: npcs,
      order: npcs.map((c) => c.id),
      resources: 0,
      armed: false,
      escapeReady: false,
      interpreterId: null,
      goodsTaken: 0,
    },
    goal: { ...scenario.goal },
    plan: [],
    stepCursor: 0,
    initiative: {},
    combatRound: false,
    defending: [],
    grudges: {},
    leaderDownRolled: [],
    revealedSkills: [],
    revealedTemper: [],
    goalHintSeen: false,
    goalKnown: false,
    standoff: false,
    ended: 'ongoing',
    log: [],
    rngState: seed >>> 0,
  };
  for (const member of [...party, ...npcs]) {
    // This temporary encounter roll represents proximity, terrain, and conditions.
    s.initiative[member.id] = nextRoll(s) + nextRoll(s);
  }
  log(s, 'info', 'scenario.blurb', { id: scenario.id, blurb: scenario.blurb });
  if (scenario.speech === 'tongues' && !partySharesLanguageWith(party, npcs)) {
    log(s, 'bad', 'warn.noSharedLanguage');
  }
  startRound(s);
  return s;
}

function resolvePlayerTarget(s: ParleyState, ord: Order, kind: 'social' | 'appraise' | 'combat'): Character {
  const t = ord.targetId ? memberOf(s.npc, ord.targetId) : undefined;
  if (t && t.morale > 0) return t;
  const alive = aliveList(s.npc);
  if (kind === 'appraise') {
    return (
      alive.find((m) => !s.revealedSkills.includes(m.id)) ??
      alive[0] ??
      npcLeader(s)
    );
  }
  if (kind === 'combat') {
    return [...alive].sort((a, b) => a.morale - b.morale)[0] ?? npcLeader(s);
  }
  return alive.find((m) => m.id === s.npc.order[0]) ?? alive[0] ?? npcLeader(s);
}

function combatStrike(s: ParleyState, attacker: Character, target: Character, opts?: RollOpts): void {
  const guarding = s.defending.includes(target.id);
  const margin = opposedCheck(
    s,
    attacker.skills.combat + revengeBonus(s, attacker.id, target.id) + (guarding ? -2 : 0),
    target.skills.combat,
    opts,
  );
  const atkIsPlayer = !!memberOf(s.player, attacker.id);
  if (margin > 0) {
    const dmg = margin >= 3 ? 3 : 2;
    target.morale = clamp(target.morale - dmg, 0, 10);
    log(s, atkIsPlayer ? 'good' : 'bad', 'combat.strike', { a: attacker.name, t: target.name }, atkIsPlayer ? `foe morale −${dmg}` : `party morale −${dmg}`);
    checkBreaks(s, opts);
  } else if (guarding) {
    const rip = margin <= -3 ? 2 : 1;
    attacker.morale = clamp(attacker.morale - rip, 0, 10);
    log(s, atkIsPlayer ? 'bad' : 'good', 'combat.counter', { d: target.name, a: attacker.name }, atkIsPlayer ? `party morale −${rip}` : `foe morale −${rip}`);
    checkBreaks(s, opts);
  } else {
    log(s, 'info', 'combat.press', { a: attacker.name, t: target.name });
  }
}

function enterGuard(s: ParleyState, c: Character): void {
  if (!s.defending.includes(c.id)) s.defending.push(c.id);
  log(s, memberOf(s.player, c.id) ? 'good' : 'info', 'combat.guard', { c: c.name });
}

function resolvePlayerAction(s: ParleyState, ord: Order, opts?: RollOpts): void {
  const actor = memberOf(s.player, ord.actorId);
  if (!actor || actor.morale <= 0) return;
  const L = npcLeader(s);
  const isLeader = s.player.order[0] === actor.id;
  const act = ord.action;

  if (LEADER_ONLY.includes(act) && !isLeader) {
    log(s, 'info', 'act.leaderOnly', { a: actor.name });
    return;
  }

  const social =
    act === 'talk' || act === 'persuade' || act === 'offer' || act === 'bluff' || act === 'finalOffer';
  if (social) {
    const blocked = socialBlocked(s, actor);
    if (blocked) {
      log(s, 'bad', blocked);
      return;
    }
  }

  switch (act) {
    case 'hold':
      log(s, 'info', 'hold.back', { a: actor.name });
      break;
    case 'talk': {
      const T = resolvePlayerTarget(s, ord, 'social');
      const margin = opposedCheck(
        s,
        actor.skills.diplomacy + affinityMod(actor, T) + leaderMod(s) + commsPenalty(s, actor) + revengeBonus(s, actor.id, T.id),
        T.skills.diplomacy,
        opts,
      );
      const targetsLeader = T.id === s.npc.order[0];
      if (margin > 0) {
        let gain = T.temperament === 'vain' ? 2 : 1;
        if (margin >= 3) gain += 1;
        if (!targetsLeader) gain = margin >= 3 ? 1 : 0;
        if (gain > 0) {
          stanceShift(s, gain);
          log(s, 'good', 'talk.charm', { a: actor.name, t: T.name });
        } else {
          log(s, 'info', 'talk.charmDefer', { a: actor.name, t: T.name });
        }
      } else {
        log(s, 'info', 'talk.small', { a: actor.name, t: T.name });
      }
      break;
    }
    case 'persuade': {
      const T = resolvePlayerTarget(s, ord, 'social');
      const margin = opposedCheck(
        s,
        actor.skills.diplomacy + affinityMod(actor, T) + leaderMod(s) + commsPenalty(s, actor) + revengeBonus(s, actor.id, T.id),
        T.skills.diplomacy,
        opts,
      );
      const targetsLeader = T.id === s.npc.order[0];
      if (margin > 0 && targetsLeader) {
        stanceShift(s, margin >= 3 ? 2 : 1);
        log(s, 'good', 'persuade.strong', { a: actor.name, t: T.name });
      } else if (margin >= 3) {
        stanceShift(s, 1);
        log(s, 'good', 'persuade.sway', { a: actor.name, t: T.name });
      } else if (margin > 0) {
        log(s, 'info', 'persuade.swayDefer', { a: actor.name, t: T.name });
      } else {
        log(s, 'info', 'persuade.unmoved', { a: actor.name, t: T.name });
      }
      break;
    }
    case 'offer': {
      const goods = Math.max(0, Math.floor(ord.goods ?? 0));
      if (goods > s.player.resources) {
        log(s, 'bad', 'offer.tooMany', { a: actor.name });
        return;
      }
      const margin = opposedCheck(
        s,
        actor.skills.trade + affinityMod(actor, L) + leaderMod(s) + commsPenalty(s, actor) + revengeBonus(s, actor.id, L.id),
        L.skills.trade,
        opts,
      );
      const demand = s.goal.demandGoods - (margin >= 3 ? 1 : 0);
      if (s.stance >= s.goal.acceptStance && goods >= demand && goods >= 1) {
        s.player.resources -= goods;
        s.trust += 1;
        end(s, 'trade', 'end.trade', { goods }, `cargo −${goods} · trust +1`);
      } else if (goods < 1) {
        log(s, 'bad', 'offer.empty', { a: actor.name });
        stanceShift(s, -1);
      } else {
        log(s, 'info', margin >= 3 ? 'offer.brilliant' : 'offer.waved', { a: actor.name });
        if (margin < 0) stanceShift(s, -1);
      }
      break;
    }
    case 'gift': {
      if (s.stance < 3) {
        log(s, 'info', 'gift.holdBack', { a: actor.name });
        return;
      }
      if (s.player.resources < 1) {
        log(s, 'bad', 'gift.nothing', { a: actor.name });
        return;
      }
      s.player.resources -= 1;
      s.trust += 1;
      stanceShift(s, 1, true);
      log(s, 'good', 'gift.present', { a: actor.name }, 'cargo −1 · trust +1');
      if (s.stance >= 4) {
        end(s, 'alliance', 'end.alliance');
      }
      break;
    }
    case 'appraise': {
      const T = resolvePlayerTarget(s, ord, 'appraise');
      if (s.revealedSkills.includes(T.id)) {
        log(s, 'info', 'appraise.already', { a: actor.name, t: T.name });
        break;
      }
      const roll = actor.skills.perception + nextRoll(s, opts);
      if (roll >= 10) {
        s.revealedSkills.push(T.id);
        s.revealedTemper.push(T.id);
        log(s, 'good', 'appraise.full', { a: actor.name, t: T.name });
      } else if (roll >= 7) {
        s.revealedSkills.push(T.id);
        log(s, 'good', 'appraise.partial', { a: actor.name, t: T.name });
      } else {
        log(s, 'info', 'appraise.little', { a: actor.name, t: T.name });
      }
      break;
    }
    case 'sizeup': {
      const roll = actor.skills.perception + nextRoll(s, opts);
      if (roll >= 10) {
        s.goalHintSeen = true;
        s.goalKnown = true;
        log(s, 'good', 'sizeup.full', {
          a: actor.name,
          goal: s.goal.name,
          demand: s.goal.demandGoods,
          outcome: s.goal.defaultOutcome === 'attack' ? 'attack' : 'walk away',
          breaks: s.goal.breaksToFlee,
        });
      } else if (roll >= 7) {
        s.goalHintSeen = true;
        log(s, 'good', 'sizeup.hint', { a: actor.name, hint: s.goal.hint });
      } else {
        log(s, 'info', 'sizeup.opaque', { a: actor.name });
      }
      break;
    }
    case 'threaten': {
      const T = resolvePlayerTarget(s, ord, 'social');
      const margin = opposedCheck(
        s,
        actor.skills.diplomacy + affinityMod(actor, T) + leaderMod(s) + revengeBonus(s, actor.id, T.id),
        T.skills.diplomacy,
        opts,
      );
      s.patience -= 1;
      if (margin > 0) {
        const dmg = margin >= 3 ? 3 : 2;
        T.morale = clamp(T.morale - dmg, 0, 10);
        if (margin >= 3) {
          for (const m of aliveList(s.npc)) {
            if (m.id !== T.id) m.morale = clamp(m.morale - 1, 0, 10);
          }
        }
        stanceShift(s, -1);
        noteGrudge(s, T.id, actor.id);
        log(s, 'good', 'threaten.win', { a: actor.name, t: T.name }, `foe morale −${dmg}`);
        checkBreaks(s, opts);
      } else {
        stanceShift(s, -1);
        log(s, 'bad', 'threaten.hollow', { a: actor.name, t: T.name });
      }
      break;
    }
    case 'bluff': {
      const T = resolvePlayerTarget(s, ord, 'social');
      const margin = opposedCheck(
        s,
        actor.skills.diplomacy + affinityMod(actor, T) + leaderMod(s) + commsPenalty(s, actor) + revengeBonus(s, actor.id, T.id),
        T.skills.perception,
        opts,
      );
      if (margin > 0) {
        stanceShift(s, 1);
        log(s, 'good', 'bluff.win', { a: actor.name, t: T.name });
      } else if (margin <= -3) {
        stanceShift(s, -1);
        s.patience -= 1;
        noteGrudge(s, T.id, actor.id);
        log(s, 'bad', 'bluff.seen', { a: actor.name, t: T.name });
      } else {
        log(s, 'info', 'bluff.waver', { a: actor.name, t: T.name });
      }
      break;
    }
    case 'interpret': {
      if (s.player.interpreterId) {
        log(s, 'info', 'interpret.already');
      } else if (groupSharesLanguage(actor, aliveList(s.npc))) {
        s.player.interpreterId = actor.id;
        log(s, 'good', 'interpret.bridge', { a: actor.name });
      } else {
        log(s, 'bad', 'interpret.cannot', { a: actor.name });
      }
      break;
    }
    case 'draw': {
      if (s.standoff) break;
      s.player.armed = true;
      s.npc.armed = true;
      s.standoff = true;
      const alive = aliveList(s.player);
      if (alive.length > 0) {
        const favored = nextRoll(s, opts) % alive.length;
        alive.forEach((member, i) => {
          const bonus = i === favored ? 2 : 1;
          s.initiative[member.id] = clamp((s.initiative[member.id] ?? 2) + bonus, 2, 12);
        });
      }
      stanceShift(s, -1);
      log(s, 'bad', 'draw.standoff');
      break;
    }
    case 'attack': {
      if (!s.standoff) {
        log(s, 'info', 'attack.noSteel', { a: actor.name });
        break;
      }
      const T = resolvePlayerTarget(s, ord, 'combat');
      combatStrike(s, actor, T, opts);
      break;
    }
    case 'defend': {
      if (!s.standoff) {
        log(s, 'info', 'defend.noSteel', { a: actor.name });
        break;
      }
      enterGuard(s, actor);
      break;
    }
    case 'signalEscape': {
      s.player.escapeReady = true;
      log(s, 'good', 'escape.signal', { a: actor.name });
      break;
    }
    case 'rally': {
      const margin = opposedCheck(s, actor.skills.leadership + leaderMod(s), L.skills.leadership, opts);
      const gain = margin >= 3 ? 3 : margin > 0 ? 2 : 1;
      applyMoraleToSide(s.player, gain);
      log(s, 'good', 'rally.party', { a: actor.name }, `party morale +${gain}`);
      break;
    }
    case 'coordinatedThreat': {
      s.patience -= 1;
      const margin = opposedCheck(s, actor.skills.leadership + leaderMod(s), L.skills.leadership, opts);
      if (margin > 0) {
        L.morale = clamp(L.morale - 2, 0, 10);
        stanceShift(s, -1);
        noteGrudge(s, L.id, actor.id);
        log(s, 'good', 'threat.coordWin', { a: actor.name }, 'foe leader morale −2');
        checkBreaks(s, opts);
      } else {
        stanceShift(s, -1);
        log(s, 'bad', 'threat.coordFlat', { a: actor.name });
      }
      break;
    }
    case 'finalOffer': {
      const margin = opposedCheck(
        s,
        actor.skills.diplomacy + affinityMod(actor, L) + leaderMod(s) + commsPenalty(s, actor) + revengeBonus(s, actor.id, L.id),
        L.skills.diplomacy,
        opts,
      );
      if (margin > 0) {
        if (s.stance >= 2) {
          s.trust += 1;
          end(s, 'deal', 'end.deal', { a: actor.name }, 'trust +1');
        } else {
          log(s, 'info', 'finalOffer.cold');
        }
      } else {
        stanceShift(s, -1);
        s.patience -= 1;
        log(s, 'bad', 'finalOffer.refused');
      }
      break;
    }
    case 'withdraw': {
      const bestPerc = Math.max(...aliveList(s.npc).map((m) => m.skills.perception), 0);
      const bonus = s.player.escapeReady ? 2 : 0;
      const margin = opposedCheck(s, actor.skills.perception + bonus, bestPerc, opts);
      if (margin > 0) {
        end(s, 'escaped', 'end.escaped');
      } else {
        s.npc.armed = true;
        s.standoff = true;
        s.patience -= 1;
        log(s, 'bad', 'withdraw.spotted');
      }
      break;
    }
  }
}

function chooseNpcAction(s: ParleyState, actor: Character, opts?: RollOpts): NpcAction {
  if (s.player.armed && !s.npc.armed) return 'draw';
  const t = actor.temperament;
  const pool: NpcAction[] = [];
  const push = (a: NpcAction, w: number) => {
    for (let i = 0; i < w; i++) pool.push(a);
  };
  if (t === 'aggressive') {
    push('threaten', 3);
    push('persuade', 1);
    push('talk', 1);
    push('demand', 1);
    if (s.stance <= 1) push('draw', 2);
  } else if (t === 'cautious') {
    push('talk', 2);
    push('persuade', 1);
    push('demand', 1);
    push('rally', 1);
    if (s.stance <= 0) push('draw', 1);
  } else if (t === 'greedy') {
    push('demand', 3);
    push('persuade', 1);
    push('talk', 1);
    if (s.stance <= 0) push('draw', 1);
  } else {
    push('talk', 3);
    push('persuade', 2);
    push('demand', 1);
  }
  const pick = pool[nextRoll(s, opts) % pool.length];
  return pick;
}

function chooseNpcTarget(s: ParleyState, actor: Character, kind: 'social' | 'pressure'): Character {
  const alive = aliveList(s.player);
  if (alive.length === 0) return playerLeader(s);
  const L = playerLeader(s);
  if (kind === 'social') {
    if (L.morale > 0 && nextRoll(s) % 10 < 6) return L;
    const others = alive.filter((m) => m.id !== L.id);
    return others.length ? others[nextRoll(s) % others.length] : L;
  }
  let best = alive[0];
  let bestScore = -Infinity;
  for (const p of alive) {
    const score =
      grudgeOf(s, actor.id, p.id) * 3 +
      (p.id === s.player.order[0] ? 1 : 0) +
      (nextRoll(s) % 3);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

function resolveNpcAction(s: ParleyState, actor: Character, opts?: RollOpts): void {
  const beast = s.speech === 'beasts';
  const act = chooseNpcAction(s, actor, opts);
  switch (act) {
    case 'talk': {
      const T = chooseNpcTarget(s, actor, 'social');
      const margin = opposedCheck(
        s,
        actor.skills.diplomacy + affinityMod(actor, T) + revengeBonus(s, actor.id, T.id),
        T.skills.diplomacy,
        opts,
      );
      const targetsLeader = T.id === s.player.order[0];
      if (margin > 0 && targetsLeader) {
        stanceShift(s, margin >= 3 ? 2 : 1);
        log(s, 'info', beast ? 'npc.talk.leaderB' : 'npc.talk.leader', { a: actor.name, t: T.name });
      } else if (margin >= 3) {
        stanceShift(s, 1);
        log(s, 'info', beast ? 'npc.talk.swayB' : 'npc.talk.sway', { a: actor.name, t: T.name });
      } else if (margin > 0) {
        log(s, 'info', beast ? 'npc.talk.warmB' : 'npc.talk.warm', { a: actor.name, t: T.name });
      } else {
        log(s, 'info', beast ? 'npc.talk.pleasantB' : 'npc.talk.pleasant', { a: actor.name, t: T.name });
      }
      break;
    }
    case 'persuade': {
      const T = chooseNpcTarget(s, actor, 'social');
      const margin = opposedCheck(
        s,
        actor.skills.diplomacy + affinityMod(actor, T) + revengeBonus(s, actor.id, T.id),
        T.skills.diplomacy,
        opts,
      );
      const targetsLeader = T.id === s.player.order[0];
      if (margin > 0 && targetsLeader) {
        stanceShift(s, margin >= 3 ? 2 : 1);
        log(s, 'good', beast ? 'npc.persuade.hardB' : 'npc.persuade.hard', { a: actor.name, t: T.name });
      } else if (margin >= 3) {
        stanceShift(s, 1);
        log(s, 'good', 'npc.persuade.around', { a: actor.name, t: T.name });
      } else if (margin > 0) {
        log(s, 'info', 'npc.persuade.defer', { a: actor.name, t: T.name });
      } else {
        log(s, 'info', beast ? 'npc.persuade.failB' : 'npc.persuade.fail', { a: actor.name, t: T.name });
      }
      break;
    }
    case 'threaten': {
      const T = chooseNpcTarget(s, actor, 'pressure');
      const margin = opposedCheck(
        s,
        actor.skills.diplomacy + affinityMod(actor, T) + revengeBonus(s, actor.id, T.id),
        T.skills.diplomacy,
        opts,
      );
      s.patience -= 1;
      if (margin > 0) {
        const dmg = margin >= 3 ? 3 : 2;
        T.morale = clamp(T.morale - dmg, 0, 10);
        if (margin >= 3) {
          for (const m of aliveList(s.player)) {
            if (m.id !== T.id) m.morale = clamp(m.morale - 1, 0, 10);
          }
        }
        stanceShift(s, -1);
        noteGrudge(s, T.id, actor.id);
        log(s, 'bad', beast ? 'npc.threaten.bluntB' : 'npc.threaten.blunt', { a: actor.name, t: T.name }, `party morale −${dmg}`);
        checkBreaks(s, opts);
      } else {
        stanceShift(s, -1);
        log(s, 'info', beast ? 'npc.threaten.postureB' : 'npc.threaten.posture', { a: actor.name, t: T.name });
      }
      break;
    }
    case 'demand': {
      const T = chooseNpcTarget(s, actor, 'pressure');
      const margin = opposedCheck(
        s,
        actor.skills.trade + affinityMod(actor, T) + revengeBonus(s, actor.id, T.id),
        T.skills.trade,
        opts,
      );
      if (margin > 0) {
        const taken = Math.min(1, s.player.resources);
        s.player.resources -= taken;
        s.npc.goodsTaken += taken;
        stanceShift(s, 1);
        noteGrudge(s, T.id, actor.id);
        if (taken > 0) {
          log(s, 'bad', beast ? 'npc.demand.takeB' : 'npc.demand.take', { a: actor.name, t: T.name }, 'cargo −1');
        } else {
          log(s, 'bad', beast ? 'npc.demand.emptyB' : 'npc.demand.empty', { a: actor.name, t: T.name });
        }
        if (s.npc.goodsTaken >= s.goal.demandGoods && s.npc.goodsTaken > 0) {
          end(s, 'trade', beast ? 'end.demandMetB' : 'end.demandMet', { goods: s.npc.goodsTaken }, `cargo −${s.npc.goodsTaken} total`);
        }
      } else {
        log(s, 'good', beast ? 'npc.demand.keepB' : 'npc.demand.keep', { a: actor.name, t: T.name });
      }
      break;
    }
    case 'draw': {
      s.npc.armed = true;
      s.player.armed = true;
      s.standoff = true;
      stanceShift(s, -1);
      log(s, 'bad', beast ? 'npc.drawB' : 'npc.draw', { a: actor.name });
      break;
    }
    case 'rally': {
      applyMoraleToSide(s.npc, 2);
      log(s, 'info', beast ? 'npc.rallyB' : 'npc.rally', { a: actor.name }, 'foe morale +2');
      break;
    }
  }
}

function resolveNpcCombatAction(s: ParleyState, actor: Character, opts?: RollOpts): 'attack' | 'defend' {
  const pool: Array<'attack' | 'defend'> = [];
  const push = (a: 'attack' | 'defend', w: number) => {
    for (let i = 0; i < w; i++) pool.push(a);
  };
  if (actor.temperament === 'cautious') {
    push('attack', 2);
    push('defend', 2);
  } else {
    push('attack', 3);
    push('defend', 1);
  }
  const act = pool[nextRoll(s, opts) % pool.length];
  if (act === 'defend') {
    enterGuard(s, actor);
    return 'defend';
  }
  const T = chooseNpcTarget(s, actor, 'pressure');
  combatStrike(s, actor, T, opts);
  return 'attack';
}

function endOfRound(s: ParleyState): void {
  if (s.ended !== 'ongoing') return;
  s.patience -= 1;
  if (s.patience > 0) {
    s.round += 1;
    startRound(s);
    return;
  }
  if (s.standoff) {
    s.round += 1;
    if (s.round > 20) {
      end(s, 'defeat', 'end.overrun');
      return;
    }
    startRound(s);
    return;
  }
  if (s.goal.defaultOutcome === 'attack') {
    s.npc.armed = true;
    s.player.armed = true;
    s.standoff = true;
    s.round += 1;
    log(s, 'bad', 'patience.spent');
    startRound(s);
  } else {
    end(s, 'walkedAway', 'end.walkedAway');
  }
}

export function resolveStep(state: ParleyState, orders: Order[], opts?: RollOpts): ParleyState {
  const s: ParleyState = structuredClone(state);
  if (s.ended !== 'ongoing') return s;
  const step = s.plan[s.stepCursor];
  if (!step) {
    endOfRound(s);
    return s;
  }
  if (step.side === 'player') {
    const actor = memberOf(s.player, step.actorId);
    if (actor && actor.morale > 0) {
      const ord = orders.find((o) => o.actorId === actor.id);
      if (s.standoff) {
        const act = ord?.action;
        if (ord && (act === 'attack' || act === 'defend' || act === 'withdraw' || act === 'rally' || act === 'hold')) {
          resolvePlayerAction(s, ord, opts);
          if (act !== 'defend') {
            s.defending = s.defending.filter((d) => d !== actor.id);
          }
        } else {
          log(s, 'info', 'standoff.keepsSeat', { a: actor.name });
        }
      } else if (ord) {
        resolvePlayerAction(s, ord, opts);
        if (ord.action !== 'defend') {
          s.defending = s.defending.filter((d) => d !== actor.id);
        }
      }
    }
  } else {
    const actor = memberOf(s.npc, step.actorId);
    if (actor && actor.morale > 0) {
      if (s.combatRound) {
        const act = resolveNpcCombatAction(s, actor, opts);
        if (act !== 'defend') {
          s.defending = s.defending.filter((d) => d !== actor.id);
        }
      } else {
        resolveNpcAction(s, actor, opts);
      }
    }
  }
  if (s.ended === 'ongoing' && s.standoff && !s.combatRound) {
    s.plan = s.plan.slice(0, s.stepCursor + 1);
  }
  s.stepCursor += 1;
  if (s.ended === 'ongoing' && s.stepCursor >= s.plan.length) {
    endOfRound(s);
  }
  return s;
}

export function resolveRound(
  state: ParleyState,
  orders: Order[],
  opts?: RollOpts,
): ParleyState {
  let s: ParleyState = structuredClone(state);
  if (s.ended !== 'ongoing') return s;
  const startRoundNum = s.round;
  let guard = 0;
  while (s.ended === 'ongoing' && s.round === startRoundNum && guard++ < 40) {
    s = resolveStep(s, orders, opts);
  }
  return s;
}
