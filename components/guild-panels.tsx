'use client';
import { SkillTreePanel } from './skill-tree-panel';
import { GearLabel, GearStats } from './gear-presentation';
import { GearWorkshop } from './gear-workshop';
import { useState, useSyncExternalStore } from 'react';
import { InfoHint, Term } from './info-hint';
import { HELP, recruitingOdds, affixHelp } from '@/lib/glossary';
import * as G from '@/lib/realm';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Pick,
  Buy,
  type Act,
  type Destination,
  duration,
} from './realm-panels';
type Props = {
  s: G.State;
  act: Act;
  go: (d: Destination) => void;
  focus?: Destination;
};
const listener = (cb: () => void) => {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
};
function useSize() {
  return useSyncExternalStore(
    listener,
    () => (innerWidth < 700 ? 1 : innerHeight < 840 ? 2 : 4),
    () => 4,
  );
}
function Pages({
  page,
  count,
  set,
}: {
  page: number;
  count: number;
  set: (n: number) => void;
}) {
  return (
    <nav className="econ-pager" aria-label="公会清单分页">
      <button disabled={!page} onClick={() => set(page - 1)}>
        ← 上一页
      </button>
      <span>
        {page + 1} / {Math.max(1, count)}
      </span>
      <button disabled={page + 1 >= count} onClick={() => set(page + 1)}>
        下一页 →
      </button>
    </nav>
  );
}
function Person({ s, h }: { s: G.State; h: G.Hero }) {
  const d = G.heroDefinition(s, h.id),
    t = G.TALENTS.find((t) => t.id === h.talent)!;
  return (
    <>
      <div className="guild-person">
        <strong className={'potential-' + h.quality}>{h.name}</strong>
        <span>
          {d.role} · Lv.{h.level}
        </span>
      </div>
      <p className="guild-meta">
        <InfoHint {...G.originHelp(h)}>{h.origin}</InfoHint> ·{' '}
        <span className={'potential-' + h.quality}>
          <Term name="potential">潜力 {'★'.repeat(h.quality)}</Term>
        </span>{' '}
        · <Term name="aptitudes">资质</Term> 体{h.aptitude.hp} / 攻
        {h.aptitude.attack} / 防{h.aptitude.defense}
        {' · 成长 ×'}
        {G.POTENTIAL_GROWTH[h.quality - 1]}
      </p>
      <p>
        <InfoHint
          className={'rarity-' + t.rarity}
          {...G.characterTalentHelp(h)}
        >
          <b>{t.name}</b>
        </InfoHint>
        ：{G.characterTalentHelp(h).body.split('\n')[0]}
      </p>
      <p>
        <Term name="mastery">专精 {h.mastery}/5</Term>
      </p>
    </>
  );
}
export function GuildRecruitment({ s, act, go }: Props) {
  const [page, setPage] = useState(0),
    size = useSize(),
    count = Math.ceil(s.guild.applicants.length / (size === 1 ? 1 : 3)),
    current = Math.min(page, Math.max(0, count - 1));
  return (
    <div className="econ-board guild-board">
      <div className="econ-board-head">
        <strong>渡鸦酒馆 · 旅人招募</strong>
        <span>名册 {s.heroes.length}/12</span>
        <button onClick={() => go({ view: 'heroes' })}>管理小队 →</button>
      </div>
      {!s.buildings.tavern ? (
        <button
          className="econ-unlock"
          onClick={() => go({ view: 'town', building: 'tavern' })}
        >
          先建造酒馆，旅人才会前来应募 →
        </button>
      ) : (
        <>
          <div className="guild-recruit-controls">
            <button
              className="econ-action"
              disabled={!!G.recruitmentRefreshReason(s)}
              onClick={() => {
                act((x) => G.refreshApplicants(x));
                setPage(0);
              }}
            >
              {s.time >= s.guild.refreshAt
                ? '免费迎接新旅人'
                : `邀请下一批旅人 · ${G.costText(G.refreshCost(s))} · 1封信`}
            </button>
            <span>
              {s.time < s.guild.refreshAt
                ? `${duration(s.guild.refreshAt - s.time)} 后免费刷新`
                : '旅人正在镇外等候'}{' '}
              · 引荐信 {s.civic.invitations}/200
            </span>
          </div>
          <div className="hero-term-line">
            <InfoHint {...recruitingOdds(s)}>角色出现率</InfoHint>
            <InfoHint title="五星大保底" body={HELP.fiveStarPity.body}>
              五星保底 {s.guild.fiveStarMisses}/80 ·{' '}
              {G.recruitmentStage(s) < 2
                ? '击败首领后开放'
                : `最多再 ${80 - s.guild.fiveStarMisses} 位`}
            </InfoHint>
            <InfoHint {...G.recruitmentProgressHelp(s)}>战绩提升招募</InfoHint>
            <Term name="potential">潜力与成长</Term>
            <Term name="aptitudes">独立资质</Term>
            <Term name="talent">天赋</Term>
          </div>
          {G.recruitmentRefreshReason(s) && (
            <small className="life-hint">{G.recruitmentRefreshReason(s)}</small>
          )}
        </>
      )}
      <div className="guild-candidates">
        {s.guild.applicants
          .slice(
            current * (size === 1 ? 1 : 3),
            (current + 1) * (size === 1 ? 1 : 3),
          )
          .map((h) => (
            <article className="guild-card" key={h.id}>
              <div className="guild-card-body">
                <Person s={s} h={h} />
                <div className="hero-term-line">
                  {G.skillsForRole(h.role)
                    .filter((skill) =>
                      [
                        G.DEFAULT_SKILL[h.role],
                        G.TREE_ROLES.find((r) => r.id === h.role)!.a,
                        G.TREE_ROLES.find((r) => r.id === h.role)!.b,
                      ].includes(skill.id),
                    )
                    .map((skill) => (
                      <InfoHint key={skill.id} {...G.skillHelp(skill.id)}>
                        {skill.name}
                      </InfoHint>
                    ))}
                </div>
              </div>
              <Buy
                s={s}
                cost={G.recruitmentCost(h)}
                reason={
                  s.heroes.length >= 12 ? '名册已满，请先在队伍中退役一人' : ''
                }
                label={`雇佣 ${h.name}`}
                onClick={() => act((x) => G.recruit(x, h.id))}
              />
            </article>
          ))}
      </div>
      {!s.guild.applicants.length && s.buildings.tavern > 0 && (
        <p className="life-effect">
          这批旅人已全部雇佣。可免费等待下一批，或花费金币邀请下一批旅人。
        </p>
      )}
      {count > 1 && <Pages page={current} count={count} set={setPage} />}
    </div>
  );
}
export function GuildTeam({ s, act, go, focus }: Props) {
  const [selected, setSelected] = useState(
      focus?.hero || s.heroes[0]?.id || '',
    ),
    [detail, setDetail] = useState<string | null>(null),
    [recipe, setRecipe] = useState(focus?.recipe || 'blade'),
    // Navigation remounts this panel; ordinary ticks preserve the player's choice.
    [craftTier, setCraftTier] = useState(() =>
      Math.max(1, Math.min(G.gearTier(s), Math.trunc(focus?.tier ?? G.gearTier(s)))),
    ),
    [slotFilter, setSlotFilter] = useState('all'),
    [picker, setPicker] = useState(false);
  const busy = !!s.battle || !!s.expedition,
    h = s.heroes.find((member) => member.id === selected) || s.heroes[0],
    stats = G.partyStats(s),
    profile = G.partyProfile(s),
    personal = h ? G.individualStats(s, h) : null,
    item = s.guild.inventory.find((g) => g.id === detail),
    heroLocked = !!h && G.heroAway(s, h.id),
    recipes = G.RECIPES.filter((r) => G.recipeDiscovered(s, r.id)),
    chosen = recipes.find((r) => r.id === recipe) || recipes[0],
    forgeSlots = G.GEAR_SLOTS.filter((slot) =>
      recipes.some((r) => r.slot === slot),
    ),
    slotRecipes = recipes.filter((r) => r.slot === chosen?.slot),
    gearList = s.guild.inventory
      .filter(
        (g) =>
          slotFilter === 'all' ||
          G.RECIPES.find((r) => r.id === g.recipe)!.slot === slotFilter,
      )
      .toReversed();
  const inspect = (g: G.Gear) => {
    setPicker(false);
    setDetail(g.id);
  };
  const openEquipment = (slot: string) => {
    setSlotFilter(slot);
    setPicker(true);
  };
  const partyReason = busy
    ? '小队在外，归来后可调整出战名单'
    : !h || s.party.includes(h.id)
      ? ''
      : s.party.length >= 4
        ? '小队已满，先将一人转为候补'
        : '';
  return (
    <div className="team-desk">
      <aside className="team-roster" aria-label="队伍角色列表">
        <div className="desk-heading">
          <strong>旅人名册</strong>
          <small>{s.heroes.length}/12</small>
        </div>
        <div className="team-roster-list">
          {s.heroes.map((member) => (
            <button
              key={member.id}
              className="team-roster-row"
              aria-pressed={h?.id === member.id}
              onClick={() => setSelected(member.id)}
            >
              <span
                className={
                  s.party.includes(member.id)
                    ? 'roster-state active'
                    : 'roster-state'
                }
              >
                {s.party.includes(member.id) ? '战' : '备'}
              </span>
              <span className={'roster-name potential-' + member.quality}>
                {member.name}
                <small>{'★'.repeat(member.quality)}</small>
              </span>
              <small>Lv.{member.level}</small>
            </button>
          ))}
        </div>
        <button
          className="secondary-button"
          onClick={() => go({ view: 'recruit' })}
        >
          招募旅人
        </button>
        <small className="desk-muted">职业自由组合 · 留守获得 40% 经验</small>
      </aside>
      <section className="team-detail" aria-label="选中角色详情">
        <div className="team-party-line">
          <strong>
            出战 {s.party.length}/4 · <Term name="partyPower">战力</Term>{' '}
            {stats.power}
          </strong>
          <span>
            生命 {stats.hp} · 攻击 {stats.attack} · 防御 {stats.defense}
          </span>
          <small>
            <Term name="resistance">火 / 暗 / 神抗</Term>{' '}
            {Math.round(profile.fire * 100)} /{' '}
            {Math.round(profile.shadow * 100)} /{' '}
            {Math.round(profile.radiant * 100)}%
          </small>
        </div>
        {h && personal ? (
          <>
            <div className="team-overview">
              <div>
                <h3>
                  <span className={'potential-' + h.quality}>{h.name}</span>{' '}
                  <small>
                    {G.heroDefinition(s, h.id).role} · Lv.{h.level}
                  </small>
                </h3>
                <p>
                  生命 <b>{Math.round(personal.hp)}</b> · 攻击{' '}
                  <b>{Math.round(personal.attack)}</b> · 防御{' '}
                  <b>{Math.round(personal.defense)}</b>
                  <InfoHint
                    title={G.heroDefinition(s, h.id).skill}
                    body={G.heroDefinition(s, h.id).skillText}
                  >
                    {G.heroDefinition(s, h.id).skill}
                  </InfoHint>
                </p>
              </div>
              <div className="team-assignment">
                <button
                  className="primary-button"
                  disabled={!!partyReason}
                  onClick={() => act((x) => G.toggleParty(x, h.id))}
                >
                  {s.party.includes(h.id) ? '转为候补' : '编入小队'}
                </button>
                {partyReason && (
                  <small className="life-hint">{partyReason}</small>
                )}
              </div>
            </div>
            <HeroTraits h={h} />
            <div className="team-columns">
              <section
                className={
                  focus?.tab === 'training'
                    ? 'training-actions desk-focused'
                    : 'training-actions'
                }
                aria-label="角色培养"
              >
                <div className="desk-heading">
                  <strong>培养</strong>
                  <small>
                    <Term name="levels">本阶段 Lv.{G.levelCap(s)}</Term>
                  </small>
                </div>
                <p className="desk-muted">
                  <span className={'potential-' + h.quality}>
                    <Term name="potential">潜力 {'★'.repeat(h.quality)}</Term>
                  </span>{' '}
                  · 成长 ×{G.POTENTIAL_GROWTH[h.quality - 1]}
                  <br />
                  <Term name="aptitudes">资质</Term> 体 {h.aptitude.hp} / 攻{' '}
                  {h.aptitude.attack} / 防 {h.aptitude.defense}
                </p>
                <div className="hero-loadout">
                  <InfoHint {...G.skillHelp(G.heroSkill(h).id)}>
                    携带技能
                  </InfoHint>
                  <Pick
                    label="携带职业技能"
                    disabled={heroLocked}
                    value={G.heroSkill(h).id}
                    options={G.unlockedSkills(h).map((skill) => ({
                      value: skill.id,
                      label: skill.name + ' · ' + skill.energy + '士气',
                    }))}
                    onChange={(value) =>
                      act((x) => G.setHeroSkill(x, h.id, value))
                    }
                  />
                </div>
                {h.level >= 20 && (
                  <div className="hero-loadout">
                    <InfoHint
                      title="第二技能栏"
                      body="根技能常备。Lv.20可同时携带两项不同分支技能，每人每回合仍只行动一次，共享士气、独立冷却。"
                    >
                      第二技能
                    </InfoHint>
                    <Pick
                      label="第二携带技能"
                      disabled={heroLocked}
                      value={h.secondarySkill || ''}
                      options={[
                        { value: '', label: '不携带' },
                        ...G.unlockedSkills(h)
                          .filter(
                            (skill) =>
                              skill.id !== G.DEFAULT_SKILL[h.role] &&
                              skill.id !== G.heroSkill(h).id,
                          )
                          .map((skill) => ({
                            value: skill.id,
                            label: skill.name,
                          })),
                      ]}
                      onChange={(value) =>
                        act((x) => G.setSecondarySkill(x, h.id, value))
                      }
                    />
                  </div>
                )}
                <div className="team-experience">
                  <SkillTreePanel s={s} h={h} act={act} />
                  <InfoHint
                    title="暴击与闪避"
                    body="个人暴击率上限60%，默认暴击造成150%伤害；个人闪避上限40%，仅能躲避单体攻击，群体重击不能闪避。职业、装备词条与技能树均可提升。"
                  >
                    暴击 {Math.round(G.individualStats(s, h).crit * 100)}% ·
                    闪避 {Math.round(G.individualStats(s, h).dodge * 100)}%
                  </InfoHint>
                  <span>
                    <Term name="xp">经验</Term> {Math.floor(h.xp)} /{' '}
                    {60 + h.level * h.level * 10}
                  </span>
                  <progress value={h.xp} max={60 + h.level * h.level * 10} />
                </div>
                <Buy
                  s={s}
                  cost={G.payableTrainCost(s, h)}
                  reason={
                    heroLocked
                      ? '该角色正在出征'
                      : h.level >= G.levelCap(s)
                        ? '达到本阶段等级上限'
                        : ''
                  }
                  label="训练升一级"
                  onClick={() => act((x) => G.train(x, h.id))}
                />
                {s.buildings.tavern >= 2 && (
                  <>
                    <div className="desk-heading">
                      <span>
                        <Term name="mastery">专精 {h.mastery}/5 · 当前开放 {G.masteryLimit(s)} 阶</Term>
                      </span>
                      <small>每级基础血 / 攻 / 防 +4%</small>
                    </div>
                    <Buy
                      s={s}
                      cost={G.masteryCost(h)}
                      materials={G.masteryMaterials(s, h)}
                      reason={G.masteryReason(s, h)}
                      label="培养专精"
                      onClick={() => act((x) => G.mentorHero(x, h.id))}
                    />
                  </>
                )}
                <InfoHint
                  title="培养投入与传承"
                  body={`1–5星训练花费倍率：${G.TRAINING_FACTORS.join(' / ')}；经验倍率：${G.LEARNING_FACTORS.join(' / ')}。\n退役时，实际支付的新训练费用80%转为全公会训练抵扣。经验、招募、装备和已消耗抵扣不返还，旧培养没有账目不追算。\n当前可抵扣：${s.civic.trainingCredit.gold} 金、${s.civic.trainingCredit.food} 粮；下次训练自动使用。\n这位角色退役可传承：${Math.floor((h.trainingInvestment?.gold || 0) * 0.8)} 金、${Math.floor((h.trainingInvestment?.food || 0) * 0.8)} 粮。`}
                >
                  训练抵扣 {s.civic.trainingCredit.gold} 金 /{' '}
                  {s.civic.trainingCredit.food} 粮
                </InfoHint>
                <button
                  className="life-text-button team-retire"
                  disabled={heroLocked}
                  onClick={() => setDetail('retire:' + h.id)}
                >
                  安排退役…
                </button>
              </section>
              <section className="gear-slots" aria-label="角色装备">
                <div className="desk-heading">
                  <strong>个人装备</strong>
                  <button
                    className="life-text-button"
                    disabled={heroLocked || !Object.keys(h.equipment).length}
                    onClick={() => act((x) => G.unequipAllGear(x, h.id))}
                  >
                    一键卸下
                  </button>
                  <button
                    className="life-text-button"
                    onClick={() => go({ view: 'heroes', tab: 'inventory', hero: h.id })}
                  >
                    整理仓库 {s.guild.inventory.length}/{G.INVENTORY_CAP}
                  </button>
                </div>
                <div className="equipment-six-grid">
                  {G.GEAR_SLOTS.map((slot) => {
                    const g = s.guild.inventory.find(
                      (g) => g.id === h.equipment[slot],
                    );
                    return (
                      <article className="team-gear-slot" key={slot}>
                        <div className="desk-heading">
                          <small>{G.SLOT_NAMES[slot]}</small>
                          <button
                            className="life-text-button"
                            onClick={() => openEquipment(slot)}
                          >
                            {g ? '更换' : '选择装备'}
                          </button>
                        </div>
                        {g ? (
                          <>
                            <GearLabel s={s} item={g} />
                            <GearStats s={s} item={g} />
                            <div className="team-gear-actions">
                              <button
                                className="life-text-button"
                                onClick={() => inspect(g)}
                              >
                                强化 / 重铸
                              </button>
                              <button
                                className="life-text-button quick-unequip"
                                aria-label={'卸下' + G.SLOT_NAMES[slot]}
                                disabled={heroLocked}
                                onClick={() =>
                                  act((x) => G.unequipGear(x, h.id, slot))
                                }
                              >
                                卸下
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="desk-muted">尚未装备</p>
                        )}
                      </article>
                    );
                  })}
                </div>
                <div className="equipment-set-summary">
                  {G.equippedSets(s, h).map((set) => (
                    <InfoHint key={set.id} title={set.name} body={set.text}>
                      <span className={set.count >= 2 ? 'set-active' : ''}>
                        {set.name} {set.count}/4 ·{' '}
                        {set.count >= 4
                          ? '2/4件生效'
                          : set.count >= 2
                            ? '2件生效'
                            : '未激活'}
                      </span>
                    </InfoHint>
                  ))}
                </div>
                <small className="desk-muted">
                  六槽可自由混搭。套装按本人穿戴的件数生效。
                </small>
              </section>
              <section
                className={
                  focus?.tab === 'forge'
                    ? 'forge-mini desk-focused'
                    : 'forge-mini'
                }
                aria-label="锻造与行装"
              >
                <div className="desk-heading">
                  <strong>
                    <InfoHint
                      title="城镇锻造"
                      body={
                        '旅人在外探索或战斗时，城里的工坊仍可打造新装备。新品直接进入装备库；留守角色可以立即换装，出征角色归来后可调整。\n' +
                        HELP.tier.body
                      }
                    >
                      锻造
                    </InfoHint>
                  </strong>
                  <small>
                    <Term name="dust">锻造尘 {s.guild.dust}/9999</Term>
                  </small>
                </div>
                {chosen ? (
                  <>
                    <div
                      className="forge-slot-filter"
                      role="group"
                      aria-label="按装备部位筛选锻造配方"
                    >
                      {forgeSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          aria-pressed={chosen.slot === slot}
                          onClick={() =>
                            setRecipe(recipes.find((r) => r.slot === slot)!.id)
                          }
                        >
                          {G.SLOT_NAMES[slot]}
                        </button>
                      ))}
                    </div>
                    <Pick
                      label={G.SLOT_NAMES[chosen.slot] + '配方'}
                      value={chosen.id}
                      onChange={setRecipe}
                      options={slotRecipes.map((r) => ({
                        value: r.id,
                        label: r.name,
                      }))}
                    />
                    <Pick
                      label="装备阶级"
                      value={String(craftTier)}
                      onChange={(v) => setCraftTier(Number(v))}
                      options={Array.from(
                        { length: G.gearTier(s) },
                        (_, i) => ({
                          value: String(i + 1),
                          label:
                            'T' +
                            (i + 1) +
                            ' · 相对T1 ×' +
                            (G.gearTierScale(i + 1) / G.gearTierScale(1)).toFixed(2),
                        }),
                      )}
                    />
                    <GearStats
                      s={s}
                      item={{
                        id: 'preview',
                        recipe: chosen.id,
                        tier: craftTier,
                        rarity: 1,
                        affix: 0,
                        upgrade: 0,
                      }}
                      base
                    />
                    <Buy
                      s={s}
                      cost={G.recipeCost(s, chosen.id, craftTier)}
                      materials={G.recipeMaterialCost(s, chosen.id, craftTier)}
                      reason={G.forgeReason(s, chosen.id, craftTier)}
                      label="锻造一件"
                      onClick={() =>
                        act((x) => G.craftGear(x, chosen.id, craftTier))
                      }
                    />
                    <div className="hero-term-line">
                      <Term name="rarity">品质概率</Term>
                      <Term name="craftPity">
                        四次保底 {s.guild.crafts % 4}/4
                      </Term>
                      <Term name="tier">装备阶级</Term>
                    </div>
                  </>
                ) : (
                  <p className="desk-muted">探索中寻找装备配方。</p>
                )}
                {G.townRank(s) >= 1 && (
                  <div
                    className={
                      focus?.tab === 'kit'
                        ? 'team-kit desk-focused'
                        : 'team-kit'
                    }
                  >
                    <div className="desk-heading">
                      <strong>
                        <Term name="kit">全队行装</Term>
                      </strong>
                      <small>{s.kit}/5 阶</small>
                    </div>
                    <small className="desk-muted">
                      每阶全队攻击 +6%、生命 +8%
                    </small>
                    <Buy
                      s={s}
                      cost={G.kitCost(s)}
                      materials={G.kitMaterialCost(s)}
                      reason={busy ? '等待队伍归来' : G.kitReason(s)}
                      label="升级行装"
                      onClick={() => act(G.upgradeKit)}
                    />
                  </div>
                )}
              </section>
            </div>
          </>
        ) : (
          <div className="desk-empty">
            <h3>营火旁还没有冒险者</h3>
            <p>前往酒馆招募，随后在这里配置小队、培养和换装。</p>
            <button
              className="primary-button"
              onClick={() => go({ view: 'recruit' })}
            >
              前往招募
            </button>
          </div>
        )}
      </section>
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="life-dialog team-gear-picker">
          <DialogTitle>{h?.name || '旅人'} · 装备库</DialogTitle>
          <DialogDescription>
            选择后直接装备到当前旅人；标明原主人的装备可转交。共{' '}
            {s.guild.inventory.length}/{G.INVENTORY_CAP} 件。
          </DialogDescription>
          <Pick
            label="筛选装备部位"
            value={slotFilter}
            onChange={setSlotFilter}
            options={[
              { value: 'all', label: '全部 · 最近获得优先' },
              ...G.GEAR_SLOT_OPTIONS,
            ]}
          />
          <div className="gear-picker-list">
            {gearList.map((g) => {
              const owner = s.heroes.find((member) =>
                Object.values(member.equipment).includes(g.id),
              );
              return (
                <article className="gear-picker-row" key={g.id}>
                  <div>
                    <GearLabel s={s} item={g} />
                    <GearStats s={s} item={g} />
                    <small className="desk-muted">
                      {owner
                        ? owner.name +
                          (G.heroAway(s, owner.id) ? '出征携带' : '正在使用')
                        : '闲置'}{' '}
                      ·{' '}
                      <InfoHint {...affixHelp(g.affix, s, g)}>
                        {G.AFFIXES[g.affix].text}
                      </InfoHint>
                    </small>
                  </div>
                  <div className="gear-picker-actions">
                    <button
                      className="primary-button"
                      disabled={
                        heroLocked ||
                        G.gearAway(s, g.id) ||
                        !h ||
                        owner?.id === h.id
                      }
                      onClick={() => {
                        if (h) {
                          act((x) => G.equipGear(x, h.id, g.id));
                          setPicker(false);
                        }
                      }}
                    >
                      {owner?.id === h?.id
                        ? '已装备'
                        : owner
                          ? '转交并装备'
                          : '装备'}
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => inspect(g)}
                    >
                      强化 / 重铸
                    </button>
                  </div>
                </article>
              );
            })}
            {!gearList.length && (
              <p>暂无此类装备，可在同页锻造，或从远征中获得。</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
      >
        <DialogContent className="life-dialog">
          <DialogTitle>{item ? G.gearName(item) : '安排旅人退役'}</DialogTitle>
          <DialogDescription>
            {item
              ? '强化与重铸确定生效；定向词条消耗同品质分解材料。出征角色携带的装备归来后可整备。'
              : '这位旅人会离开，穿戴装备全部归还装备库。'}
          </DialogDescription>
          {item ? (
            <GearWorkshop key={item.id} s={s} item={item} act={act} onRemoved={() => setDetail(null)} />
          ) : (
            <button
              className="primary-button"
              disabled={G.heroAway(s, detail?.slice(7) || '')}
              onClick={() => {
                act((x) => G.dismissHero(x, detail!.slice(7)));
                setDetail(null);
              }}
            >
              确认退役并归还装备
            </button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function HeroTraits({ h }: { h: G.Hero }) {
  const talent = G.TALENTS.find((t) => t.id === h.talent)!;
  return (
    <div className="hero-term-line">
      <InfoHint {...G.originHelp(h)}>{h.origin}</InfoHint>
      <InfoHint
        className={'rarity-' + talent.rarity}
        {...G.characterTalentHelp(h)}
      >
        {talent.name}
      </InfoHint>
    </div>
  );
}

export function DoctrinePanel({ s, act }: { s: G.State; act: Act }) {
  const [page, setPage] = useState(0),
    size = useSize() === 1 ? 1 : 3,
    items = [
      {
        id: 'logistics' as const,
        name: '运输与后勤',
        text: '远征耗时除以 1 + 等级×6%；更快把据点产物运回城镇。',
      },
      {
        id: 'smithing' as const,
        name: '工匠传承',
        text: '全部装备的攻击、生命、防御系数每级增加5%。',
      },
      {
        id: 'scholarship' as const,
        name: '野外学术',
        text: '每次调查额外增加2点敌情；减少调查次数，更快获得战术增伤。',
      },
    ];
  return (
    <div className="guild-pane">
      <div className="guild-candidates">
        {items
          .slice(
            Math.min(page, Math.ceil(items.length / size) - 1) * size,
            (Math.min(page, Math.ceil(items.length / size) - 1) + 1) * size,
          )
          .map((d) => (
            <div className="guild-card" key={d.id}>
              <div className="guild-card-body">
                <h3>
                  {d.name} · {s.guild.doctrine[d.id]}/10
                </h3>
                <p>{d.text}</p>
                <p>
                  当前阶段可研至 {Math.min(10, 2 + G.townRank(s) * 2)}{' '}
                  级，城镇进阶研究继续开放。
                </p>
              </div>
              <Buy
                s={s}
                cost={G.doctrineCost(s, d.id)}
                reason={
                  s.battle
                    ? '战后可研究'
                    : !s.buildings.tavern
                      ? '先建酒馆'
                      : s.guild.doctrine[d.id] >=
                          Math.min(10, 2 + G.townRank(s) * 2)
                        ? '达到本阶段上限'
                        : ''
                }
                label="投入研究"
                onClick={() => act((x) => G.studyDoctrine(x, d.id))}
              />
            </div>
          ))}
      </div>
      {size === 1 && <Pages page={page} count={3} set={setPage} />}
    </div>
  );
}
export function FrontierPanel({
  s,
  act,
  go,
  region: r,
}: {
  s: G.State;
  act: Act;
  go: (d: Destination) => void;
  region: number;
}) {
  const f = G.frontierInfo(s, r),
    next = G.routeInfo(s, r, 'frontier'),
    out = s.guild.outposts[r],
    reason = G.dispatchReason(s, r, 'frontier', s.order.reserve);
  return (
    <div className="guild-card">
      <div className="guild-card-body">
        <div className="guild-frontier-path">
          {G.FRONTIERS[r].map((name, i) => (
            <div
              className={i < f.depth ? 'done' : i === f.depth ? 'current' : ''}
              key={name}
            >
              <b>{i < f.depth ? '✓' : i + 1}</b>
              <span>{name}</span>
            </div>
          ))}
        </div>
        <h3>
          {f.depth === 5 ? '道路已打通' : f.name} · 据点 {f.depth}/5
        </h3>
        <p className="guild-meta">
          {f.depth < 5
            ? `夺取奖励：${G.FRONTIER_REWARDS[f.depth].replace('本地区资源', G.RESOURCE_NAMES[G.FRONTIER_RESOURCES[r]])}。`
            : '五处据点奖励已生效：生产加成、稀有战利品与首领护甲弱点。'}
        </p>
        <p>
          {f.depth < 5
            ? `推进 ${s.guild.progress[r]}/${f.required}；预计成功每趟 +${f.progress}`
            : '可以准备首领决战，或继续调查与采集。'}{' '}
          · 敌情 {s.guild.intel[r]}/100
        </p>
        <div className="guild-summary">
          <strong>
            {f.guaranteed
              ? f.ratio >= 2
                ? '战力碾压 · 必定成功'
                : '充分准备或受挫保底 · 必定成功'
              : `本次推进成功率 ${Math.floor(f.chance * 1000) / 10}%`}
          </strong>
          <span>
            有效战力 {f.effective} / 地区基准 {f.power}
          </span>
        </div>
        <p className="guild-meta">
          有效战力达到敌人基准 2
          倍，必定推进且不遭伏击。战力越高推进越快；敌人不会跟随你的等级变强。每次成功
          +{f.progress} 推进。
        </p>
        <p>驻地 {out}/3：每级物资收益 +25%、粮耗 -10%、首领承伤 -5%。</p>
        <Buy
          s={s}
          cost={G.outpostCost(s, r)}
          reason={
            s.battle
              ? '战后可建设'
              : f.depth < 1
                ? '夺取第一处据点后建设'
                : out >= 3
                  ? '驻地已满级'
                  : ''
          }
          label="建设地区驻地"
          onClick={() => act((x) => G.buildOutpost(x, r))}
        />
        <p className="guild-meta">
          调查提高敌情，最多提供 +10%
          决战伤害；深入据点提高补给收益与装备掉落率。单趟约{' '}
          {duration(next.duration)}，消耗 {next.cost} 粮。
        </p>
      </div>
      <div className="guild-actions">
        <button
          className="econ-action"
          disabled={f.depth >= 5 || !s.party.length}
          onClick={() =>
            go({
              view: 'explore',
              region: r,
              tab: 'mission',
              route: 'frontier',
            })
          }
        >
          准备推进 →
        </button>
        <button
          className="secondary-button"
          onClick={() =>
            go({ view: 'explore', region: r, tab: 'mission', route: 'survey' })
          }
        >
          准备调查 →
        </button>
        <button
          className="secondary-button"
          onClick={() => go({ view: 'explore', region: r, tab: 'boss' })}
        >
          备战首领 →
        </button>
      </div>
      {reason && f.depth < 5 && <p className="guild-meta">{reason}</p>}
    </div>
  );
}
export function BattleBrief({
  s,
  act,
  go,
  region: r,
}: {
  s: G.State;
  act: Act;
  go: (d: Destination) => void;
  region: number;
}) {
  const [report, setReport] = useState<{
    prepared: ReturnType<typeof G.forecastBattle>;
    basic: ReturnType<typeof G.forecastBattle>;
  } | null>(null);
  const enemy = G.REGIONS[r],
    m = G.battleModifiers(s, r),
    reason = G.bossReason(s, r),
    prep = s.guild.preparation;
  return (
    <div className="guild-card guild-battle-brief">
      <div className="guild-card-body guild-brief-grid">
        <section className="guild-brief-column">
          <h3>{enemy.boss}</h3>
          <p>{G.ENEMIES[r].tip}</p>
          <div className="guild-summary">
            生命 {G.enemyDefinition(s, r, 'boss').hp} · 攻击{' '}
            {G.enemyDefinition(s, r, 'boss').attack} · 护甲{' '}
            {G.enemyArmor(s, r).toFixed(1)}
            <span>主要伤害：{G.ELEMENT_NAMES[G.ENEMIES[r].element]}</span>
          </div>
          <p>
            对应抗性 {Math.round(m.resistance * 100)}% · 穿甲{' '}
            {Math.round(m.pierce * 100)}% · 远程贡献{' '}
            {Math.round(m.ranged * 100)}%
          </p>
          <p className="guild-meta">
            敌情 {s.guild.intel[r]}/100 · 据点 {s.guild.depths[r]}/5 · 驻地{' '}
            {s.guild.outposts[r]}/3。31回合起敌人逐步狂怒。
          </p>
        </section>
        <section className="guild-brief-column">
          <div className="guild-preparations">
            <Pick
              id="battle-stance"
              label="战术姿态"
              value={prep.stance}
              onChange={(v) => {
                act((x) =>
                  G.setPreparation(x, { stance: v as typeof prep.stance }),
                );
                setReport(null);
              }}
              options={[
                { value: 'balanced', label: '均衡 · 标准攻防' },
                { value: 'cautious', label: '谨慎 · 伤害与承伤 -10%' },
                { value: 'assault', label: '强攻 · 伤害与承伤 +12%' },
              ]}
            />
            <Pick
              id="battle-element"
              label="抗性药剂"
              value={prep.element}
              onChange={(v) => {
                act((x) => G.setPreparation(x, { element: v as G.Element }));
                setReport(null);
              }}
              options={[
                { value: 'physical', label: '不携带抗性药剂' },
                ...(['shadow', 'fire', 'radiant'] as const).map((e) => ({
                  value: e,
                  label: `${G.ELEMENT_NAMES[e]}抗性药剂 +20%`,
                })),
              ]}
            />
            <label className="life-switch" htmlFor="battle-remedy">
              额外药囊 +2
              <Switch
                id="battle-remedy"
                checked={prep.remedy}
                disabled={!!s.expedition}
                onCheckedChange={(v) => {
                  act((x) => G.setPreparation(x, { remedy: v }));
                  setReport(null);
                }}
              />
            </label>
          </div>
          <p className="guild-meta">
            准备费用：{G.costText(G.battlePreparationCost(s))}
            。药剂只在正式出战时扣除，推演不花材料。
          </p>
          <button
            className="life-text-button"
            onClick={() => go({ view: 'heroes', tab: 'inventory' })}
          >
            根据敌人调整阵容与装备 →
          </button>
        </section>
      </div>
      {report && (
        <div className="guild-forecast">
          <p>
            <b>按预案：{report.prepared.win ? '可取胜' : '此次预案未能取胜'}</b>{' '}
            · {report.prepared.rounds} 回合 · 余生命 {report.prepared.hp}
          </p>
          <p>
            只普通攻击：{report.basic.win ? '取胜' : '战败'} ·{' '}
            {report.basic.rounds} 回合
          </p>
          <small>
            使用真实战斗规则、相同敌人和当前阵容逐回合计算。换装后重新推演；预案失败不代表所有操作都无法取胜。
          </small>
        </div>
      )}
      {reason && <p className="life-effect">{reason}</p>}

      <div className="guild-actions">
        <button
          className="secondary-button"
          disabled={!!reason}
          onClick={() =>
            setReport({
              prepared: G.forecastBattle(s, r),
              basic: G.forecastBattle(s, r, 'attack'),
            })
          }
        >
          进行战前推演
        </button>
        <button
          className="econ-action"
          disabled={!!reason}
          onClick={() => act((x) => G.startBattle(x, r))}
        >
          发起决战
        </button>
        {s.order.enabled && (
          <button
            className="secondary-button"
            onClick={() => act((x) => G.setOrder(x, { enabled: false }))}
          >
            归来后休息
          </button>
        )}
      </div>
    </div>
  );
}
