import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import * as T from '../lib/tactics.ts';
import * as R from '../lib/relic-combat.ts';
import {
  arena,
  town,
  own,
  unit,
  learn,
  sync,
  act,
  relic,
  endRound,
  clone,
} from './v03-combat-fixtures.mjs';

test('relic and selected skills are frozen at departure; absent legacy snapshots stay absent', () => {
  const s = arena(own(town(), 'R02', 2));
  assert.equal(unit(s, 2).relic.id, 'R02');
  delete s.worldExploration.relics.combat.R02;
  s.heroes[2].activeSkill = 'starfall';
  assert.equal(unit(s, 2).relic.id, 'R02');
  assert.equal(T.combatSkills(s, s.party[2])[0].id, 'star_shatter');
  delete unit(s, 2).relic;
  T.validateBattle(s);
  assert.equal(unit(s, 2).relic, undefined);
});

test('hourglass consumes an action, boosts only the next chosen direct skill and never stacks', () => {
  let s = arena(own(town(), 'R02', 2));
  const initialEnergy = s.battle.energy;
  s = relic(s, 'charge', 'star_shatter', 2);
  assert.equal(s.battle.energy, initialEnergy);
  assert.equal(s.battle.actionCount, 1);
  assert.ok(s.battle.acted.includes(s.party[2]));
  s = endRound(s);
  assert.equal(unit(s, 2).relic.charge.round, 1);
  const doubled = R.relicCommand(s.party[2], 'charge', 'star_shatter');
  assert.match(T.tacticalReason(s, doubled), /不能叠加/);
  assert.equal(T.tacticalCombat(s, doubled), s);
  const normal = clone(s);
  delete unit(normal, 2).relic.charge;
  const beforeHp = s.battle.enemyHp;
  const boosted = act(s, 'star_shatter', 2),
    plain = act(normal, 'star_shatter', 2);
  assert.equal(
    beforeHp - boosted.battle.enemyHp,
    Math.round((beforeHp - plain.battle.enemyHp) * 1.8),
  );
  assert.equal(unit(boosted, 2).relic.charge, undefined);
  assert.equal(
    unit(boosted, 2).cooldowns.star_shatter,
    unit(plain, 2).cooldowns.star_shatter,
  );
  const abandoned = act(s, 'attack', 2);
  assert.equal(unit(abandoned, 2).relic.charge, undefined);
  assert.equal(unit(endRound(abandoned), 2).relic.charge, undefined);
});

test('split healing uses each target own max HP, charges extra energy and does not duplicate cleanse or supply', () => {
  let s = arena(own(town(), 'R04', 1));
  Object.assign(unit(s), { hp: 10, maxHp: 2000, burn: 2 });
  Object.assign(unit(s, 2), { hp: 10, maxHp: 3000, burn: 2 });
  sync(s);
  const supply = s.battle.supplies;
  s = relic(s, 'split', 'mortal_light', 1, s.party[0], s.party[2]);
  assert.equal(unit(s).hp, 10 + Math.round((100 + 600 + 400) * 0.7));
  assert.equal(unit(s, 2).hp, 10 + Math.round((100 + 600 + 600) * 0.35));
  assert.equal(unit(s).burn, 0);
  assert.equal(unit(s, 2).burn, 2);
  assert.equal(s.battle.energy, 6);
  assert.equal(s.battle.supplies, supply - 1);
  assert.equal(unit(s, 1).cooldowns.mortal_light, 5);
});

test('transfer moves all eligible protection and taunt to one ally without creating double shields', () => {
  let s = arena(own(learn(town(), 3, 'iron_vigil'), 'R06', 3));
  const before = unit(s, 3).shield;
  s = relic(s, 'transfer', 'iron_vigil', 3, s.party[0]);
  assert.equal(unit(s, 3).shield, before);
  assert.equal(unit(s, 3).guard, 1);
  assert.equal(unit(s).shield, 290);
  assert.equal(unit(s).guard, 0.2);
  assert.equal(s.battle.taunt, s.party[0]);
  assert.equal(unit(s, 3).cooldowns.iron_vigil, 6);
  const other = arena(own(town(), 'R06', 0));
  assert.match(
    T.tacticalReason(
      other,
      R.relicCommand(other.party[0], 'transfer', 'home_oath', other.party[1]),
    ),
    /自用/,
  );
});

test('borrowed morale is private debt, repaid before shared energy; debt cannot enable skill chains', () => {
  let s = arena(own(town(), 'R08', 2));
  s.battle.energy = 1;
  s = relic(s, 'borrow', 'star_shatter', 2);
  assert.equal(s.battle.energy, 0);
  assert.equal(unit(s, 2).relic.debt, 2);
  assert.equal(unit(s, 2).cooldowns.star_shatter, 5);
  s = act(s, 'attack', 0);
  assert.equal(s.battle.energy, 1);
  assert.equal(unit(s, 2).relic.debt, 2);
  s = endRound(s);
  assert.match(T.tacticalReason(s, T.commandFor(s.party[2], 'break')), /偿清/);
  const energy = s.battle.energy;
  s = act(s, 'attack', 2);
  assert.equal(unit(s, 2).relic.debt, 1);
  assert.equal(s.battle.energy, energy);
  s = endRound(s);
  const energy2 = s.battle.energy;
  s = act(s, 'guard', 2);
  assert.equal(unit(s, 2).relic.debt, 0);
  assert.equal(s.battle.energy, energy2);
});

test('projectile conversion trades power for reach and cannot convert existing ranged skills', () => {
  const s = arena(own(learn(town(), 0, 'shield_breaker'), 'R10', 0), 'flight');
  const normal = act(clone(s), 'shield_breaker');
  const ranged = relic(s, 'project', 'shield_breaker');
  assert.ok(
    Math.abs(
      s.battle.enemyHp -
        ranged.battle.enemyHp -
        3 * (s.battle.enemyHp - normal.battle.enemyHp),
    ) <= 1,
  );
  assert.equal(
    unit(ranged).cooldowns.shield_breaker,
    unit(normal).cooldowns.shield_breaker + 1,
  );
  const invalid = arena(own(town(), 'R10', 2));
  assert.match(
    T.tacticalReason(
      invalid,
      R.relicCommand(invalid.party[2], 'project', 'star_shatter'),
    ),
    /近身/,
  );
});

test('tuning pays an action and sealed skill; cooldown clocks survive reload and cannot be tuned recursively', () => {
  let s = arena(own(learn(town(), 0, 'shield_breaker'), 'R12'));
  unit(s, 2).cooldowns.star_shatter = 1;
  sync(s);
  s = relic(s, 'tune', 'star_shatter', 0, s.party[2], 'shield_breaker');
  assert.equal(s.battle.energy, 8);
  assert.equal(unit(s, 2).cooldowns.star_shatter, 0);
  assert.equal(unit(s, 2).tunedRound, 1);
  assert.equal(unit(s).relic.cooldown, 3);
  assert.equal(unit(s).cooldowns.shield_breaker, 2);
  assert.equal(s.battle.actionCount, 1);
  assert.ok(!s.battle.acted.includes(s.party[2]));
  s = endRound(s);
  assert.equal(unit(s).relic.cooldown, 3);
  assert.equal(unit(s).relic.sealed.remaining, 2);
  const loaded = G.decodeSave(JSON.stringify(s));
  assert.ok(loaded);
  assert.deepEqual(loaded.battle, s.battle);
  assert.match(
    T.tacticalReason(
      s,
      R.relicCommand(
        s.party[0],
        'tune',
        'star_shatter',
        s.party[2],
        'shield_breaker',
      ),
    ),
    /冷却/,
  );
  s = endRound(s);
  assert.equal(unit(s).relic.cooldown, 2);
  assert.equal(unit(s).relic.sealed.remaining, 1);
  s = endRound(s);
  assert.equal(unit(s).relic.cooldown, 1);
  assert.equal(unit(s).relic.sealed, undefined);
});

test('automatic projectile conversion is not applied after a site enemy has already landed', () => {
  const s = own(learn(town(), 0, 'shield_breaker'), 'R10');
  s.battle = T.snapshotSiteCombat(s, 'S06', 'A', 1234);
  s.battle.interrupted = true;
  s.battle.enemyAttack = 1;
  s.battle.energy = 10;
  s.battle.acted = s.party.slice(1);
  s.battle.selected = s.party[0];
  const c = T.autoCommand(s);
  assert.equal(T.tacticalReason(s, c), '');
  assert.equal(c, T.commandFor(s.party[0], 'shield_breaker'));
});

test('automatic tuning never promises an immediate healing cast from a debtor who is still forbidden to cast', () => {
  const s = arena(
    own(own(town(['finn', 'luna', 'rhea', 'kael']), 'R12', 0), 'R08', 1),
  );
  s.battle.energy = 6;
  s.battle.enemyAttack = 800;
  s.battle.target = s.party[2];
  unit(s, 2).hp = 700;
  unit(s, 1).cooldowns.mortal_light = 1;
  unit(s, 1).relic.debt = 1;
  sync(s);
  const c = T.autoCommand(s);
  assert.equal(T.tacticalReason(s, c), '');
  assert.ok(!c.includes('relic~tune'), c);
});

test('invalid relic payloads are rejected before mutation and automatic play returns legal actions', () => {
  for (const id of R.COMBAT_RELIC_IDS) {
    let s = arena(own(town(), id));
    const illegal = R.relicCommand(s.party[0], 'borrow', 'unknown');
    const before = clone(s);
    assert.ok(T.tacticalReason(s, illegal));
    assert.equal(T.tacticalCombat(s, illegal), s);
    assert.deepEqual(s, before);
    for (let i = 0; i < 24 && s.battle; i++) {
      const cmd = T.autoCommand(s);
      assert.equal(T.tacticalReason(s, cmd), '', id + ': ' + cmd);
      s = T.tacticalCombat(s, cmd, true);
    }
    const broken = arena(own(town(), id));
    unit(broken).relic.cooldown = Infinity;
    assert.throws(() => T.validateBattle(broken), /遗物/);
  }
});

// Every pair operates through real commands in a bounded, validator-accepted arena.
// Fixed starting wounds/energy isolate the interactions; they are not playthrough claims.
for (let a = 0; a < R.COMBAT_RELIC_IDS.length; a++)
  for (let c = a + 1; c < R.COMBAT_RELIC_IDS.length; c++) {
    const pair = [R.COMBAT_RELIC_IDS[a], R.COMBAT_RELIC_IDS[c]];
    test(`${pair.join('+')}: both real abilities, action limits, morale, cooldowns and mid-fight saves stay bounded`, () => {
      let s = learn(
        learn(town(['rhea', 'luna', 'orin', 'kael']), 0, 'shield_breaker'),
        2,
        'iron_vigil',
      );
      const carriers = { R02: 3, R04: 1, R06: 2, R08: 3, R10: 0, R12: 0 };
      if (pair.includes('R02') && pair.includes('R08')) carriers.R08 = 0;
      if (pair.includes('R10') && pair.includes('R12')) carriers.R12 = 2;
      for (const id of pair) own(s, id, carriers[id]);
      s = arena(s);
      s.battle.enemyAttack = 1;
      for (const u of s.battle.units) u.hp = 100;
      s.battle.energy = pair.includes('R08')
        ? pair.includes('R12')
          ? 3
          : 1
        : 10;
      if (pair.includes('R12')) unit(s, 1).cooldowns.mortal_light = 1;
      sync(s);
      const taken = [];
      function checked(command) {
        assert.equal(
          T.tacticalReason(s, command),
          '',
          `${pair.join('+')}: ${command}`,
        );
        const before = s.battle.actionCount;
        const next = T.tacticalCombat(s, command);
        assert.equal(
          next.battle.actionCount,
          before + 1,
          'one command cannot duplicate actions',
        );
        assert.ok(next.battle.energy >= 0 && next.battle.energy <= 10);
        assert.equal(new Set(next.battle.acted).size, next.battle.acted.length);
        const loaded = G.decodeSave(JSON.stringify(next));
        assert.ok(loaded, `${pair.join('+')} save`);
        assert.deepEqual(loaded.battle, next.battle);
        assert.equal(T.autoCommand(loaded), T.autoCommand(next));
        s = loaded;
      }
      function waitFor(command, index) {
        let attempts = 0;
        while (T.tacticalReason(s, command) && attempts++ < 20) {
          const free = s.battle.units.filter(
            (u) => u.hp > 0 && !s.battle.acted.includes(u.id),
          );
          const assistant =
            free.find((u) => u.id !== s.party[index]) || free[0];
          checked(T.commandFor(assistant.id, 'guard'));
        }
        assert.ok(
          attempts < 20,
          `${pair.join('+')} cannot endlessly wait for ${command}`,
        );
        checked(command);
      }
      const order = [...pair].sort(
        (x, y) =>
          (x === 'R12' ? -2 : x === 'R08' ? -1 : 0) -
          (y === 'R12' ? -2 : y === 'R08' ? -1 : 0),
      );
      for (const id of order) {
        const i = carriers[id],
          actor = s.party[i];
        const actions = {
          R02: () => R.relicCommand(actor, 'charge', 'star_shatter'),
          R04: () =>
            R.relicCommand(
              actor,
              'split',
              'mortal_light',
              s.party[0],
              s.party[3],
            ),
          R06: () =>
            R.relicCommand(actor, 'transfer', 'iron_vigil', s.party[0]),
          R08: () =>
            R.relicCommand(
              actor,
              'borrow',
              i === 3 ? 'star_shatter' : 'shield_breaker',
            ),
          R10: () => R.relicCommand(actor, 'project', 'shield_breaker'),
          R12: () =>
            R.relicCommand(
              actor,
              'tune',
              'mortal_light',
              s.party[1],
              i === 0 ? 'shield_breaker' : 'iron_vigil',
            ),
        };
        waitFor(actions[id](), i);
        taken.push(id);
      }
      assert.deepEqual([...taken].sort(), pair);
      if (pair.includes('R02')) {
        const i = carriers.R02,
          round = unit(s, i).relic.charge.round;
        waitFor(T.commandFor(s.party[i], 'star_shatter'), i);
        assert.ok(
          s.battle.round <= round + 1,
          'charge is used in its one-round window',
        );
        assert.equal(unit(s, i).relic.charge, undefined);
      }
      // Subsequent automatic play must use exactly the same action/cooldown clocks after each reload.
      for (let j = 0; j < 36; j++) checked(T.autoCommand(s));
      assert.ok(s.battle.round < 20);
      assert.equal(
        s.battle.units.reduce((n, u) => n + (u.relic?.debt || 0), 0),
        0,
        'private debts were actually repaid',
      );
      for (const u of s.battle.units)
        for (const cooldown of Object.values(u.cooldowns))
          assert.ok(cooldown >= 0 && cooldown <= 9);
    });
  }
