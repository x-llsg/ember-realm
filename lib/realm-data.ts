export type Resource = 'wood' | 'food' | 'stone' | 'gold' | 'iron' | 'crystal';
export type Job = Resource;
export type BuildingId =
  | 'fire'
  | 'warehouse'
  | 'hut'
  | 'lumber'
  | 'farm'
  | 'quarry'
  | 'market'
  | 'tavern'
  | 'forge'
  | 'shrine';
export type HeroId =
  | 'rhea'
  | 'finn'
  | 'luna'
  | 'kael'
  | 'orin'
  | 'ash'
  | 'nyx'
  | 'sylva'
  | 'vera';
export type View =
  | 'town'
  | 'recruit'
  | 'heroes'
  | 'explore'
  | 'research'
  | 'destiny';
export type Cost = Partial<Record<Resource, number>>;
export const RESOURCE_NAMES: Record<Resource, string> = {
  wood: '木材',
  food: '口粮',
  stone: '石料',
  gold: '金币',
  iron: '铁锭',
  crystal: '魔晶',
};
export const JOB_NAMES: Record<Job, string> = {
  wood: '伐木工',
  food: '农夫',
  stone: '石匠',
  gold: '商人',
  iron: '锻造师',
  crystal: '炼晶师',
};
export const BASE_CAPACITY: Record<Resource, number> = {
  wood: 120,
  food: 100,
  stone: 100,
  gold: 100,
  iron: 60,
  crystal: 40,
};
export const MANUAL: Record<
  Resource,
  {
    name: string;
    amount: number;
    seconds: number;
    need: BuildingId;
    cost: Cost;
  }
> = {
  wood: { name: '拾柴', amount: 4, seconds: 3, need: 'fire', cost: {} },
  food: { name: '采粮', amount: 3, seconds: 3, need: 'fire', cost: {} },
  stone: { name: '采石', amount: 3, seconds: 3, need: 'hut', cost: {} },
  gold: { name: '摆摊', amount: 4, seconds: 6, need: 'market', cost: {} },
  iron: {
    name: '冶炼',
    amount: 2,
    seconds: 6,
    need: 'forge',
    cost: { wood: 2, stone: 4 },
  },
  crystal: {
    name: '炼晶',
    amount: 1,
    seconds: 8,
    need: 'shrine',
    cost: { gold: 3 },
  },
};
export const EXPEDITION_OUTCOMES = [
  {
    id: 'ordinary',
    name: '平安归来',
    chance: 55,
    multiplier: 1,
    rest: 0,
    text: '沿着熟悉的路往返，物资按计划运回。',
  },
  {
    id: 'abundant',
    name: '意外丰收',
    chance: 25,
    multiplier: 1.5,
    rest: 0,
    text: '伙伴找到一处未被采集的物资点，收获增加了一半。',
  },
  {
    id: 'ambush',
    name: '遭遇伏击',
    chance: 15,
    multiplier: 0.6,
    rest: 25,
    text: '小队带着线索突围，丢失部分物资，归来休整 25 秒。',
  },
  {
    id: 'cache',
    name: '古代宝匣',
    chance: 5,
    multiplier: 2,
    rest: 0,
    text: '尘封的暗格里藏着物资，伙伴带回了双倍收获。',
  },
] as const;
export const BUILDINGS: {
  id: BuildingId;
  name: string;
  tag: string;
  desc: string;
  cost: Cost;
  max: number;
  need?: BuildingId;
  chapter: number;
  effect: string;
}[] = [
  {
    id: 'fire',
    name: '篝火',
    tag: '第一夜',
    desc: '你把枯枝拢在背风处。这个世界，终于有了一点属于你的光。',
    cost: { wood: 12 },
    max: 1,
    chapter: 0,
    effect: '照亮附近的灌木，随后可以采集口粮、搭建住所',
  },
  {
    id: 'hut',
    name: '旅人小屋',
    tag: '人口',
    desc: '有了能关上的门，旅人才愿意把明天也交给这里。',
    cost: { wood: 18 },
    max: 16,
    need: 'fire',
    chapter: 0,
    effect: '每级增加 3 人口上限；住民到来后需要分工',
  },
  {
    id: 'warehouse',
    name: '物资仓库',
    tag: '容量',
    desc: '把木料垫高，把粮袋码齐。仓库决定小镇能为下一次远行准备多少物资。',
    cost: { wood: 60, stone: 40 },
    max: 12,
    need: 'fire',
    chapter: 0,
    effect: '每级令六种资源容量翻倍；满仓后暂停对应生产，不再消耗原料',
  },
  {
    id: 'lumber',
    name: '林间伐木场',
    tag: '木材',
    desc: '留下路径、磨好斧刃。熟练的工人终于接过你手中的活。',
    cost: { wood: 22, stone: 8 },
    max: 12,
    need: 'hut',
    chapter: 0,
    effect:
      '建成并分工后，1级每人产0.975木/秒；每次升级再加0.325（研究加成前）',
  },
  {
    id: 'farm',
    name: '溪畔农田',
    tag: '口粮',
    desc: '种子埋下后，远行的人才有了按时回家的底气。',
    cost: { wood: 24, stone: 8 },
    max: 12,
    need: 'hut',
    chapter: 0,
    effect:
      '建成并分工后，1级每人产0.975粮/秒；每次升级再加0.325（研究加成前）',
  },
  {
    id: 'quarry',
    name: '灰岩采石场',
    tag: '石料',
    desc: '石匠知道哪道裂隙能打开。这里的石头，会成为路、钟楼和盾墙。',
    cost: { wood: 28 },
    max: 12,
    need: 'hut',
    chapter: 0,
    effect:
      '建成并分工后，1级每人产0.700石/秒；每次升级再加0.200（研究加成前）',
  },
  {
    id: 'market',
    name: '边境集市',
    tag: '金币',
    desc: '把多余的物资交给商队，也为急缺的东西留下一个办法。',
    cost: { wood: 36, stone: 16 },
    max: 12,
    need: 'quarry',
    chapter: 0,
    effect: '开放商人和交易；进口材料比本地生产昂贵',
  },
  {
    id: 'tavern',
    name: '渡鸦酒馆',
    tag: '委托',
    desc: '第一张委托贴上门板：愿意走出山谷的人，这里管饭，也等你回来。',
    cost: { wood: 48, stone: 24, gold: 16 },
    max: 3,
    need: 'market',
    chapter: 0,
    effect: '招募伙伴并持续派遣；升级提升远征经验和携行补给',
  },
  {
    id: 'forge',
    name: '余火锻造坊',
    tag: '装备',
    desc: '山外带回的矿样有了去处。工匠把城镇的积累，锻成队伍能带走的力量。',
    cost: { wood: 65, stone: 45, gold: 28 },
    max: 12,
    need: 'tavern',
    chapter: 1,
    effect: '开放装备和锻造师；每产1铁锭消耗2.5木材、5石料；扩产需要上游供料',
  },
  {
    id: 'shrine',
    name: '无名者学馆',
    tag: '知识',
    desc: '不供奉神。这里只收藏旅人带回来的问题，以及凡人写下的答案。',
    cost: { wood: 70, stone: 80, iron: 20, gold: 50 },
    max: 12,
    need: 'forge',
    chapter: 1,
    effect: '开放研究和炼晶师；每产1魔晶消耗约3.57金币；扩产需要稳定收入',
  },
];
export const HEROES: {
  id: HeroId;
  name: string;
  role: string;
  initial: string;
  color: string;
  quote: string;
  atk: number;
  hp: number;
  def: number;
  unlock: number;
  cost: Cost;
  trait: string;
  skill: string;
  skillText: string;
  energy: number;
  cooldown: number;
}[] = [
  {
    id: 'rhea',
    name: '蕾娅',
    role: '流浪剑士',
    initial: '蕾',
    color: 'copper',
    quote: '给我一处可以回来的地方，我替你守住它。',
    atk: 18,
    hp: 120,
    def: 4,
    unlock: 0,
    cost: { gold: 18 },
    trait: '全队防御 +3',
    skill: '守家之誓',
    skillText: '造成 80% 攻击伤害，接下来的两次敌方攻击减伤 45%。',
    energy: 2,
    cooldown: 4,
  },
  {
    id: 'finn',
    name: '芬恩',
    role: '半精灵游侠',
    initial: '芬',
    color: 'green',
    quote: '森林从不沉默。只是你还没学会倾听。',
    atk: 23,
    hp: 88,
    def: 2,
    unlock: 0,
    cost: { gold: 28, food: 12 },
    trait: '远征耗时 -15%',
    skill: '猎人印记',
    skillText:
      '造成 120% 伤害并标记弱点，随后两次伤害 +20%；能射中飞行的敌人。',
    energy: 2,
    cooldown: 3,
  },
  {
    id: 'luna',
    name: '露娜',
    role: '失誓修女',
    initial: '露',
    color: 'blue',
    quote: '神没有回应。没关系，我会。',
    atk: 17,
    hp: 110,
    def: 3,
    unlock: 1,
    cost: { gold: 55 },
    trait: '补给治疗额外恢复 5% 生命',
    skill: '人间微光',
    skillText: '恢复全队 40% 生命，净化灼烧；消耗 1 份携行补给，受到禁疗限制。',
    energy: 3,
    cooldown: 4,
  },
  {
    id: 'kael',
    name: '凯尔',
    role: '逐星法师',
    initial: '凯',
    color: 'purple',
    quote: '所谓禁忌，不过是神明不愿公开的答案。',
    atk: 29,
    hp: 85,
    def: 1,
    unlock: 2,
    cost: { gold: 90, crystal: 8 },
    trait: '破势伤害 +10%',
    skill: '碎星术',
    skillText: '造成 180% 伤害，击破护盾并打断咏唱。',
    energy: 3,
    cooldown: 4,
  },
  {
    id: 'orin',
    name: '奥林',
    role: '灰誓骑士',
    initial: '奥',
    color: 'steel',
    quote: '我的王国已经覆灭。你们的不会。',
    atk: 22,
    hp: 160,
    def: 7,
    unlock: 3,
    cost: { gold: 130, iron: 18 },
    trait: '全队防御 +6',
    skill: '不落之盾',
    skillText: '本回合减伤 85%，反击造成 90% 伤害，并恢复 1 点士气。',
    energy: 1,
    cooldown: 3,
  },
  {
    id: 'ash',
    name: '烬',
    role: '龙裔猎人',
    initial: '烬',
    color: 'red',
    quote: '我的血脉来自龙。我的选择，属于我。',
    atk: 34,
    hp: 120,
    def: 4,
    unlock: 4,
    cost: { gold: 170, crystal: 22 },
    trait: '对古龙和神明伤害 +10%',
    skill: '断天之矢',
    skillText: '造成 170% 伤害，忽略护盾和飞行；对古龙与神明额外 +10%。',
    energy: 3,
    cooldown: 3,
  },
];
HEROES.push(
  {
    id: 'nyx',
    name: '妮克丝',
    role: '夜行刺客',
    initial: '影',
    color: 'purple',
    quote: '看清破绽，只需要一瞬。',
    atk: 26,
    hp: 82,
    def: 1,
    unlock: 1,
    cost: { gold: 55 },
    trait: '基础暴击12%，闪避12%',
    skill: '潜影刺',
    skillText: '会心突袭，毒刃与影步分支。',
    energy: 2,
    cooldown: 2,
  },
  {
    id: 'sylva',
    name: '希尔瓦',
    role: '荒林德鲁伊',
    initial: '林',
    color: 'green',
    quote: '伤口会愈合，森林会记得。',
    atk: 20,
    hp: 115,
    def: 3,
    unlock: 1,
    cost: { gold: 55 },
    trait: '持续回复与自然护盾',
    skill: '青枝抚愈',
    skillText: '治疗、再生，荆棘与生息分支。',
    energy: 2,
    cooldown: 3,
  },
  {
    id: 'vera',
    name: '薇菈',
    role: '行旅炼金师',
    initial: '药',
    color: 'copper',
    quote: '药与毒，只差一点配比。',
    atk: 22,
    hp: 100,
    def: 2,
    unlock: 2,
    cost: { gold: 75 },
    trait: '投射穿甲与群体药雾',
    skill: '蚀甲药瓶',
    skillText: '蚀甲投射，药理与烈剂分支。',
    energy: 2,
    cooldown: 2,
  },
);
export const REGIONS: {
  name: string;
  biome: string;
  desc: string;
  boss: string;
  epithet: string;
  hp: number;
  atk: number;
  def: number;
  power: number;
  duration: number;
  cost: number;
  reward: Cost;
  first: Cost;
  thresholds: [number, number];
  discoveries: [string, string];
  story: string;
  mechanic: string;
  kit: number;
  population: number;
}[] = [
  {
    name: '低语森林',
    biome: '迷雾林地',
    desc: '取水路被狼群截断。先找到旧聚落留下的路，再决定如何守住它。',
    boss: '荆棘狼王',
    epithet: '林中饥饿的阴影',
    hp: 2500,
    atk: 130,
    def: 3,
    power: 90,
    duration: 70,
    cost: 10,
    reward: { wood: 34, food: 26, gold: 12 },
    first: { gold: 55, iron: 8 },
    thresholds: [1, 3],
    discoveries: [
      '溪边脚印：狼群截断了取水路，流民只能结伴出门。',
      '倒塌的哨塔：旧防线图标出了狼王每夜进入山谷的缺口。',
    ],
    story: '鸟鸣回来了。矿工捡起狼穴里的铁矿，修女望向北方失声的钟楼。',
    mechanic: '每第三回合扑杀。坚守抵御重击，普通回合积累士气。',
    kit: 0,
    population: 6,
  },
  {
    name: '灰钟废墟',
    biome: '失落遗迹',
    desc: '亡者重复最后一次祈祷。修女说，她还记得那口钟的声音。',
    boss: '无面守墓人',
    epithet: '永夜钟声的守望者',
    hp: 9000,
    atk: 260,
    def: 10,
    power: 280,
    duration: 110,
    cost: 18,
    reward: { stone: 40, gold: 18, iron: 10 },
    first: { gold: 85, iron: 15, crystal: 8 },
    thresholds: [2, 5],
    discoveries: [
      '不散的弥撒：失声的钟楼把亡者困在了最后一天。',
      '钟腹里的名字：你们带回刻满姓名的钟舌，随行的旅人认出了故乡。',
    ],
    story: '安魂钟响起，亡者终于离席。银扣古书中，留下了把魔力凝成晶体的方法。',
    mechanic: '结界回合获得护盾。破势或碎星术可击穿；死亡钟鸣必须防守。',
    kit: 1,
    population: 9,
  },
  {
    name: '赤砂古道',
    biome: '荒芜边境',
    desc: '矿工与商队堵在干涸河床。黑铁军旗之下，连井水都要缴税。',
    boss: '黑铁督军',
    epithet: '断旗之下的不死军魂',
    hp: 13000,
    atk: 340,
    def: 17,
    power: 350,
    duration: 160,
    cost: 28,
    reward: { stone: 48, gold: 26, iron: 15, crystal: 5 },
    first: { gold: 120, iron: 24, crystal: 14 },
    thresholds: [2, 5],
    discoveries: [
      '沙中的车辙：难民车上装着工具，不是财宝。',
      '督军的粮道：测绘员找到了绕过要塞的旧河道。',
    ],
    story: '断路重新接上。同行者摘下头盔，向一个没有王冠的人宣誓。',
    mechanic: '督军会吸取军阵恢复生命；用破势打断补给，留意开场冲锋。',
    kit: 2,
    population: 12,
  },
  {
    name: '永夜王庭',
    biome: '魔王领地',
    desc: '每座碑都吞下一个名字。王座上的人，靠凡人的沉默维持永夜。',
    boss: '魔王 · 莫尔迦斯',
    epithet: '万军之主 · 永夜君王',
    hp: 35000,
    atk: 850,
    def: 22,
    power: 700,
    duration: 220,
    cost: 38,
    reward: { gold: 38, iron: 18, crystal: 10 },
    first: { gold: 170, iron: 35, crystal: 25 },
    thresholds: [2, 6],
    discoveries: [
      '被夺走的名字：王庭石碑以臣民的姓名供养魔王。',
      '咏唱的间隙：反咏刻板记录了阵法最脆弱的节拍。',
    ],
    story:
      '王冠落地。“我也曾试着打开那扇门。”他看着北方。你第一次明白，旅程还未结束。',
    mechanic: '末日咏唱会吸取士气；破势可打断并使魔王露出破绽。',
    kit: 3,
    population: 15,
  },
  {
    name: '龙脊雪山',
    biome: '极寒龙巢',
    desc: '山脉收拢了翅膀。它守着被抹去的历史，也守着通往天空的钥匙。',
    boss: '古龙 · 阿兹拉克',
    epithet: '最后的纪元见证者',
    hp: 50000,
    atk: 1100,
    def: 28,
    power: 900,
    duration: 300,
    cost: 48,
    reward: { gold: 46, iron: 24, crystal: 15 },
    first: { gold: 230, iron: 45, crystal: 40 },
    thresholds: [2, 6],
    discoveries: [
      '冰封营地：上一代屠龙者留下遗书，他们败于鳞甲与龙息。',
      '换鳞之地：你拾起自然脱落的龙鳞，找到了心脏附近的薄弱处。',
    ],
    story:
      '龙翼落下。龙心交到你手中时，还像一盏灯一样温热。星空背后的门，出现了。',
    mechanic: '飞行时普通攻击大幅减弱，远程技能仍能命中；挡住龙息可避免灼烧。',
    kit: 4,
    population: 18,
  },
  {
    name: '破碎天穹',
    biome: '诸神禁域',
    desc: '你看见被剪断的无数个明天。神把这一切称为秩序。',
    boss: '秩序之神 · 伊瑟',
    epithet: '命运的编织者',
    hp: 100000,
    atk: 2000,
    def: 34,
    power: 1500,
    duration: 420,
    cost: 60,
    reward: { gold: 58, iron: 30, crystal: 22 },
    first: { gold: 300, iron: 65, crystal: 60 },
    thresholds: [3, 7],
    discoveries: [
      '门后的故乡：龙心打开裂隙，你看见另一个世界曾经拥有的明天。',
      '神律原文：凡人可以活着，却不被允许选择。',
    ],
    story: '你没有坐上神座。镇子的第一口锅仍在火上，伙伴们替你留着一碗热汤。',
    mechanic:
      '神律暂时封印治疗，法则重写若未打断会恢复 8% 生命；第 19 回合后神罚逐渐增强。',
    kit: 5,
    population: 21,
  },
];
export const PROJECTS: {
  id: string;
  name: string;
  cost: Cost;
  choices: { id: string; label: string; text: string; effect: string }[];
}[] = [
  {
    id: 'watch',
    name: '修复谷口哨站',
    cost: { wood: 40, stone: 20, food: 15 },
    choices: [
      {
        id: 'forest',
        label: '林间守望',
        text: '修好林道边的灯，伐木工才能在暮色里把古木运回镇子。先保证造屋的梁木，溪边的食宿可在后来补建。',
        effect: '木材生产 +25%，远征木材 +20%',
      },
      {
        id: 'river',
        label: '溪畔庇护',
        text: '先把哨站接入取水路，让田里有收成、远行者有热饭。等林道安全，再将守望的灯连到另一岸。',
        effect: '口粮生产 +25%，远征口粮 -15%',
      },
    ],
  },
  {
    id: 'bell',
    name: '重铸安魂钟',
    cost: { wood: 60, stone: 70, iron: 12, gold: 40 },
    choices: [
      {
        id: 'alarm',
        label: '铸成警钟',
        text: '守墓人愿意把旧钟改成警报，提醒前线躲过亡灵的重击。归家的声部可以等钟楼修稳后再铸。',
        effect: '受到的首领重击伤害 -15%',
      },
      {
        id: 'home',
        label: '铸成归钟',
        text: '修女请你先铸归钟，让搬药的车夫听见回城的路。伤者有了补给，再为前线添一口警钟。',
        effect: '补给治疗多恢复 5% 生命，补给费用 -25%',
      },
    ],
  },
  {
    id: 'station',
    name: '建造赤砂转运站',
    cost: { wood: 100, stone: 100, iron: 25, gold: 70 },
    choices: [
      {
        id: 'miners',
        label: '接回矿工',
        text: '先接回流亡矿工，让废坩埚重新升温。矿石有了去处，再接通能把成品卖出去的商路。',
        effect: '锻造产量 +35%，每秒额外获得 0.1 铁锭',
      },
      {
        id: 'traders',
        label: '接通商旅',
        text: '先同商旅约好回程货单，缩短前线与城镇之间的路。车队站稳后，再将矿工的炉火搬进站内。',
        effect: '金币生产 +20%，远征耗时 -15%',
      },
    ],
  },
  {
    id: 'array',
    name: '制作破誓阵',
    cost: { wood: 140, stone: 120, iron: 35, crystal: 20 },
    choices: [
      {
        id: 'chant',
        label: '反咏刻阵',
        text: '把被王令抹去的名字刻回阵中。反咏者选择在毁灭到来时破势，之后还需要持盾者守住街巷。',
        effect: '重击回合使用破势也能将来袭伤害降低 65%',
      },
      {
        id: 'shields',
        label: '众盾成阵',
        text: '先让每一面盾牌连成掩护，承受重击的人不再孤立无援。待居民安顿，再给反咏者腾出刻阵的位置。',
        effect: '坚守士气 +2，反击提升至攻击的 40%',
      },
    ],
  },
  {
    id: 'dragon',
    name: '打造登龙装备',
    cost: { wood: 180, stone: 150, iron: 65, crystal: 35 },
    choices: [
      {
        id: 'spear',
        label: '冷锻破鳞矛',
        text: '猎人沿旧鳞的纹理开锋，先解决厚甲让远征寸步难行的问题。护送伤者下山的符记仍可随后打造。',
        effect: '忽略敌方 50% 防御',
      },
      {
        id: 'blood',
        label: '龙血庇护符',
        text: '先用庇护符保护挡住吐息的同伴，让他们活着走下雪线。等补给站建稳，再锻能刺开龙鳞的矛。',
        effect: '挡住重击后恢复 8% 生命，并净化灼烧',
      },
    ],
  },
  {
    id: 'key',
    name: '完成龙心钥匙',
    cost: { wood: 240, stone: 180, iron: 80, crystal: 55 },
    choices: [
      {
        id: 'cut',
        label: '斩断神律',
        text: '先让钥匙斩断禁愈的命令，使凡人仍能相互救助。没有写完的居民姓名，可在另一面继续刻下。',
        effect: '解除神明的治疗封印；破势伤害 +10%',
      },
      {
        id: 'chorus',
        label: '众生共鸣',
        text: '先收集每位居民的名字，让出战者记得自己为何撑住。待共鸣稳定，再将束缚治疗的神律切开。',
        effect: '全队生命 +20%，承受伤害 -10%',
      },
    ],
  },
];
export interface Research {
  id: string;
  name: string;
  desc: string;
  cost: Cost;
  chapter: number;
  discovery: number;
  need?: BuildingId;
  category: 'town' | 'adventure';
  tech?: string;
  prior?: string[];
  depth?: [number, number];
  materials?: Partial<
    Record<
      | 'timber'
      | 'essence'
      | 'ore'
      | 'ember'
      | 'scale'
      | 'star'
      | 'boards'
      | 'steel'
      | 'runes',
      number
    >
  >;
  production?: Partial<Record<Resource, number>>;
}
export const RESEARCH: Research[] = [
  {
    id: 'tools',
    name: '石斧与石镐',
    desc: '手采木、粮、石 +50%。先改善手上的工具，缩短起家时的采集。',
    cost: { wood: 75, stone: 35 },
    chapter: 0,
    discovery: 0,
    need: 'hut',
    category: 'town',
  },
  {
    id: 'baskets',
    name: '编筐与货架',
    desc: '基础物资容量 ×1.5。为雇佣伙伴与第一批装备留出空间。',
    cost: { wood: 65, food: 35 },
    chapter: 0,
    discovery: 0,
    need: 'hut',
    category: 'town',
  },
  {
    id: 'axes',
    name: '古木锯架',
    desc: '木材产出 ×1.6。木板加工持续吃木，锯架把更多劳力腾给远征。',
    cost: { wood: 320, stone: 160, gold: 100 },
    materials: { timber: 8, boards: 3 },
    chapter: 1,
    discovery: 0,
    need: 'lumber',
    tech: 'settlement',
    category: 'town',
    production: { wood: 1.6 },
  },
  {
    id: 'preservation',
    name: '风干与粮窖',
    desc: '口粮产出 ×1.6、容量 ×1.5。支持加工和反复往返。',
    cost: { wood: 240, stone: 180, food: 140 },
    materials: { timber: 6, boards: 3 },
    chapter: 1,
    discovery: 0,
    need: 'farm',
    tech: 'settlement',
    category: 'town',
    production: { food: 1.6 },
  },
  {
    id: 'masonry',
    name: '石工测绘',
    desc: '石料产出 ×1.6。加快扩仓，也能负担冶铁的石料消耗。',
    cost: { wood: 380, stone: 260, gold: 160 },
    materials: { boards: 5 },
    chapter: 1,
    discovery: 0,
    need: 'quarry',
    tech: 'settlement',
    depth: [0, 2],
    category: 'town',
    production: { stone: 1.6 },
  },
  {
    id: 'accounts',
    name: '商队账簿',
    desc: '金币产出 ×1.6。长期训练与炼晶都需要稳定的收入。',
    cost: { wood: 300, gold: 360, food: 140 },
    materials: { boards: 5 },
    chapter: 1,
    discovery: 0,
    need: 'market',
    tech: 'settlement',
    depth: [0, 2],
    category: 'town',
    production: { gold: 1.6 },
  },
  {
    id: 'scouting',
    name: '荒野侦察',
    desc: '伏击概率15%→5%，丰收25%→35%；调查线索必定推进。',
    cost: { wood: 100, food: 140, gold: 160 },
    materials: { timber: 3 },
    chapter: 0,
    discovery: 0,
    need: 'tavern',
    depth: [0, 1],
    category: 'adventure',
  },
  {
    id: 'rotation',
    name: '水车与轮作',
    desc: '木、粮、石、金产出 ×1.3。把森林水道变成市镇的动力。',
    cost: { wood: 1200, stone: 850, gold: 600 },
    materials: { boards: 16, timber: 12 },
    chapter: 2,
    discovery: 0,
    need: 'farm',
    prior: ['axes', 'preservation'],
    category: 'town',
    production: { wood: 1.3, food: 1.3, stone: 1.3, gold: 1.3 },
  },
  {
    id: 'hot_blast',
    name: '鼓风炼炉',
    desc: '铁锭产出 ×2；木石单耗不变。更快炼铁也需要更多伐木工和石匠。',
    cost: { wood: 900, stone: 1100, iron: 90, gold: 700 },
    materials: { boards: 12, ore: 12, steel: 5 },
    chapter: 2,
    discovery: 0,
    need: 'forge',
    tech: 'metallurgy',
    category: 'town',
    production: { iron: 2 },
  },
  {
    id: 'resonance',
    name: '共鸣结晶',
    desc: '魔晶产出 ×2；金币单耗不变。金币收入决定能否持续炼晶。',
    cost: { wood: 900, stone: 700, crystal: 65, gold: 1100 },
    materials: { boards: 12, essence: 12, runes: 5 },
    chapter: 2,
    discovery: 0,
    need: 'shrine',
    tech: 'runecraft',
    category: 'town',
    production: { crystal: 2 },
  },
  {
    id: 'steel',
    name: '淬火之术',
    desc: '小队攻击 +15%。精钢、铁锭与木炭共同支撑稳定的武器品质。',
    cost: { wood: 800, iron: 120, gold: 1100 },
    materials: { steel: 12, ore: 12 },
    chapter: 2,
    discovery: 0,
    need: 'forge',
    tech: 'metallurgy',
    category: 'adventure',
  },
  {
    id: 'wards',
    name: '守护铭文',
    desc: '小队防御 +20%。把遗迹中学会的铭文刻进护具。',
    cost: { wood: 750, crystal: 100, gold: 1100 },
    materials: { runes: 12, essence: 12 },
    chapter: 2,
    discovery: 0,
    need: 'shrine',
    tech: 'runecraft',
    category: 'adventure',
  },
  {
    id: 'assembly',
    name: '连动锯台',
    desc: '木材、石料产出 ×1.7。城塞建造与大型炉火需要同时扩充这两条供应线。',
    cost: { wood: 4200, stone: 3600, gold: 2800 },
    materials: { boards: 32, timber: 25 },
    chapter: 3,
    discovery: 0,
    need: 'lumber',
    prior: ['masonry', 'rotation'],
    category: 'town',
    production: { wood: 1.7, stone: 1.7 },
  },
  {
    id: 'irrigation',
    name: '分渠灌溉',
    desc: '口粮产出 ×1.8。远方委托更耗粮，先让新田接住军需。',
    cost: { wood: 3500, stone: 4800, gold: 2400 },
    materials: { boards: 30, timber: 20 },
    chapter: 3,
    discovery: 0,
    need: 'farm',
    prior: ['rotation'],
    category: 'town',
    production: { food: 1.8 },
  },
  {
    id: 'banking',
    name: '商路契约',
    desc: '金币产出 ×1.8。为长期培养和魔力工坊提供收入。',
    cost: { wood: 2600, stone: 2400, gold: 4200 },
    materials: { boards: 25 },
    chapter: 3,
    discovery: 0,
    need: 'market',
    prior: ['accounts'],
    category: 'town',
    production: { gold: 1.8 },
  },
  {
    id: 'supply_chain',
    name: '驿站补给网',
    desc: '远征口粮消耗 -20%，补给车队材料运量 +50%。扩产后的炉子需要更稳定的原料运输。',
    cost: { wood: 3600, stone: 2800, gold: 3200, food: 2200 },
    materials: { boards: 30 },
    chapter: 3,
    discovery: 0,
    need: 'tavern',
    prior: ['preservation', 'scouting'],
    category: 'adventure',
  },
  {
    id: 'blast_furnace',
    name: '赤砂高炉',
    desc: '铁锭产出再 ×2.2。为成套高阶装备准备金属，木石单耗保持不变。',
    cost: { wood: 12000, stone: 16000, iron: 650, gold: 9000 },
    materials: { boards: 60, steel: 35, ore: 40 },
    chapter: 4,
    discovery: 0,
    need: 'forge',
    prior: ['hot_blast', 'assembly'],
    category: 'town',
    production: { iron: 2.2 },
  },
  {
    id: 'ley_grid',
    name: '灵脉回路',
    desc: '魔晶产出再 ×2.2。王城法衣、药剂和符文需要稳定魔力，金币单耗保持不变。',
    cost: { wood: 11000, stone: 12000, crystal: 500, gold: 14000 },
    materials: { boards: 60, runes: 35, essence: 40 },
    chapter: 4,
    discovery: 0,
    need: 'shrine',
    prior: ['resonance', 'banking'],
    category: 'town',
    production: { crystal: 2.2 },
  },
  {
    id: 'memory',
    name: '群星记忆',
    desc: '小队生命 +20%。将边地的人名与归途记进每个人的护符。',
    cost: { wood: 7500, crystal: 420, gold: 8500 },
    materials: { boards: 30, runes: 25 },
    chapter: 4,
    discovery: 0,
    need: 'shrine',
    tech: 'runecraft',
    category: 'adventure',
  },
  {
    id: 'deep_roots',
    name: '王城供养',
    desc: '木、粮、石、金产出再 ×1.6。扩大城镇产能，承担最后一批工艺与武装。',
    cost: { wood: 22000, stone: 18000, gold: 16000, food: 12000 },
    materials: { boards: 80, timber: 60 },
    chapter: 4,
    discovery: 0,
    need: 'market',
    prior: ['assembly', 'irrigation', 'banking'],
    category: 'town',
    production: { wood: 1.6, food: 1.6, stone: 1.6, gold: 1.6 },
  },
  {
    id: 'godslayer',
    name: '弑神之理',
    desc: '攻击 +15%，开放终神决战。研究天穹样品，找到神律的裂缝。',
    cost: { wood: 30000, iron: 1800, crystal: 1200, gold: 32000 },
    materials: { star: 60, steel: 60, runes: 60 },
    chapter: 5,
    discovery: 5,
    need: 'shrine',
    tech: 'mythic',
    category: 'adventure',
  },
];
export const EVENTS: {
  id: string;
  title: string;
  text: string;
  repeat?: boolean;
  choices: {
    label: string;
    detail: string;
    cost: Cost;
    effect: string;
    reward?: Cost;
    buff?: import('./civic.ts').BuffId;
    equipment?: boolean;
  }[];
}[] = [
  {
    id: 'refugees',
    title: '雨夜的敲门声',
    text: '一对夫妇在雨里等候。屋檐下还有位置，但留下两个人，就要多准备两份安置口粮。',
    choices: [
      {
        label: '备好两份安置口粮',
        detail: '20口粮；接纳两位住民，仍需手动安排工作。',
        cost: { food: 20 },
        effect: 'settlers',
      },
      {
        label: '交换他们带来的石料',
        detail: '12口粮、8木材，换取18石料；他们随后继续赶路。',
        cost: { food: 12, wood: 8 },
        reward: { stone: 18 },
        effect: 'farmers',
      },
    ],
  },
  {
    id: 'merchant',
    title: '商人的试单',
    text: '商人愿意做一笔小生意。货物与价格写得清楚，这张货单只结算一次。',
    choices: [
      {
        label: '购入一批营建物资',
        detail: '40金币，换取32木材、24口粮。',
        cost: { gold: 40 },
        reward: { wood: 32, food: 24 },
        effect: 'imports',
      },
      {
        label: '出售一批木石',
        detail: '32木材、20石料，换取24金币。',
        cost: { wood: 32, stone: 20 },
        reward: { gold: 24 },
        effect: 'exports',
      },
    ],
  },
  {
    id: 'waterwheel',
    title: '渠边的试作',
    text: '你画出一条短短的灌溉渠。木匠愿意先做一次试验，收成与材料都会记在这次账上。',
    choices: [
      {
        label: '试修灌溉渠',
        detail: '35木材、20石料，换取50口粮。',
        cost: { wood: 35, stone: 20 },
        reward: { food: 50 },
        effect: 'waterwheel',
      },
      {
        label: '替学徒修补工具',
        detail: '20金币、10木材，换取30石料。',
        cost: { gold: 20, wood: 10 },
        reward: { stone: 30 },
        effect: 'apprentices',
      },
    ],
  },
  {
    id: 'grave',
    title: '无名的墓碑',
    text: '小队替山路上的无名者立碑。附近村民愿意负担这一趟的补给，或交来修路用的材料。',
    choices: [
      {
        label: '立碑，领取村民的补给',
        detail: '30石料、15木材，换取35口粮。',
        cost: { stone: 30, wood: 15 },
        reward: { food: 35 },
        effect: 'names',
      },
      {
        label: '修好经过墓园的小路',
        detail: '25木材、20口粮，换取12铁锭。',
        cost: { wood: 25, food: 20 },
        reward: { iron: 12 },
        effect: 'vigil',
      },
    ],
  },
  {
    id: 'passing_caravan',
    repeat: true,
    title: '随机来访 · 赶路的商队',
    text: '商队在镇口卸下货物。这次他们需要粮食和石料，愿意当场交换。',
    choices: [
      {
        label: '供给干粮',
        detail: '消耗 10 口粮，获得 12 金币。',
        cost: { food: 10 },
        reward: { gold: 12 },
        effect: 'caravan_food',
      },
      {
        label: '交换木料',
        detail: '消耗 20 石料，获得 30 木材。',
        cost: { stone: 20 },
        reward: { wood: 30 },
        effect: 'caravan_wood',
      },
    ],
  },
  {
    id: 'scrap_hunter',
    repeat: true,
    title: '随机来访 · 拾荒者的包裹',
    text: '一个拾荒者带回了废墟里的金属。他缺粮食，也缺修理背篓的材料。',
    choices: [
      {
        label: '修理背篓',
        detail: '消耗 15 木材，获得 6 铁锭。',
        cost: { wood: 15 },
        reward: { iron: 6 },
        effect: 'scrap_wood',
      },
      {
        label: '补充路粮',
        detail: '消耗 12 口粮，获得 10 金币。',
        cost: { food: 12 },
        reward: { gold: 10 },
        effect: 'scrap_food',
      },
    ],
  },
];
// Append to preserve numeric event indices in old saves.
EVENTS.push(
  {
    id: 'laborers',
    repeat: true,
    title: '轮歇的巡回劳工',
    text: '一队修路工想在镇上落脚十分钟。供给热饭，他们能帮忙采伐、收割和开石；也可以让伙夫替训练场准备便餐。',
    choices: [
      {
        label: '雇佣临时劳工',
        detail: '',
        cost: { food: 60, gold: 40 },
        effect: 'temporary_hands',
        buff: 'hands',
      },
      {
        label: '开设训练便餐',
        detail: '',
        cost: { wood: 12, gold: 6 },
        effect: 'temporary_provisions',
        buff: 'provisions',
      },
    ],
  },
  {
    id: 'master_artisan',
    repeat: true,
    title: '借火的巡游匠人',
    text: '匠人不卖秘方。他愿意花一段时间校正工坊设备，或教住民磨好手中的工具。',
    choices: [
      {
        label: '请他指导加工',
        detail: '',
        cost: { gold: 90, wood: 30 },
        effect: 'temporary_artisan',
        buff: 'artisan',
      },
      {
        label: '请他整修采集工具',
        detail: '',
        cost: { gold: 50, stone: 40 },
        effect: 'temporary_tools',
        buff: 'hands',
      },
    ],
  },
  {
    id: 'field_instructor',
    repeat: true,
    title: '老兵的十分钟讲习',
    text: '退役队长把战例写在木板上。前线归来的见闻与留守伙伴的练习，都能在这堂课里变成更多经验。',
    choices: [
      {
        label: '开办实战讲习',
        detail: '',
        cost: { gold: 75, food: 40 },
        effect: 'temporary_lessons',
        buff: 'lessons',
      },
      {
        label: '为训练场备餐',
        detail: '',
        cost: { wood: 12, gold: 6 },
        effect: 'temporary_rations',
        buff: 'provisions',
      },
    ],
  },
  {
    id: 'equipment_peddler',
    repeat: true,
    title: '游商的单件藏品',
    text: '游商只带来一件成品，品阶不会超过你已掌握的工艺。先看清属性与价格，再决定是否买下；不会自动替换任何人的装备。',
    choices: [
      {
        label: '购买这件装备',
        detail: '',
        cost: {},
        effect: 'purchased_equipment',
        equipment: true,
      },
      {
        label: '请随行匠人指导工坊',
        detail: '',
        cost: { gold: 90, wood: 30 },
        effect: 'temporary_advice',
        buff: 'artisan',
      },
    ],
  },
);
export const REBUILD = [
  {
    id: 'homes',
    name: '给归来的人一个家',
    desc: '让流民家庭搬进归人街。住民达到 24 人。',
    cost: { wood: 400, stone: 260, food: 240 } as Cost,
    story:
      '窗户里一盏接一盏亮起灯。曾在雨夜抱着种子的孩子，已经能叫出每位邻居的名字。',
  },
  {
    id: 'roads',
    name: '让六地重新往来',
    desc: '通关后，为六地各完成一次补给远征。',
    cost: { wood: 300, stone: 300, gold: 280 } as Cost,
    story:
      '再没有缴税的军旗和封路的狼群。邮差带回六封信，每一封都以“明天见”结束。',
  },
  {
    id: 'memorial',
    name: '为无名者留下名字',
    desc: '六位伙伴全部加入，学馆达到 5 级。',
    cost: { stone: 350, gold: 250, crystal: 90 } as Cost,
    story:
      '纪念馆没有神像。有人挂起旧剑，有人点亮灯，还有人把一片龙鳞放在窗边。你们决定在这里生活下去。',
  },
];
