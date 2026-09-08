import type { Character } from './guild-data.ts';

const ordinary = {
  hp: 1,
  attack: 1,
  defense: 1,
  pierce: 0,
  ranged: 0,
  resistance: 0,
  trainingGold: 1,
  trainingFood: 1,
  experience: 1,
  mastery: 1,
};
export const ORIGINS = [
  {
    name: '边境流民',
    text: '生命 +12%；训练口粮 −20%。艰难的迁徙教会了他生存。',
    ...ordinary,
    hp: 1.12,
    trainingFood: 0.8,
  },
  {
    name: '旧王国佣兵',
    text: '攻击 +8%；训练金币 −10%。旧军阵留下了熟练的身手。',
    ...ordinary,
    attack: 1.08,
    trainingGold: 0.9,
  },
  {
    name: '山地猎户',
    text: '穿甲 +12%、远程贡献 +20%。追猎的本领不限于弓箭。',
    ...ordinary,
    pierce: 0.12,
    ranged: 0.2,
  },
  {
    name: '行商护卫',
    text: '防御 +15%；训练金币 −15%。走过商路，也学会了精打细算。',
    ...ordinary,
    defense: 1.15,
    trainingGold: 0.85,
  },
  {
    name: '学徒出身',
    text: '攻击 +4%；获得经验 +25%。从一次次练习中掌握新的本领。',
    ...ordinary,
    attack: 1.04,
    experience: 1.25,
  },
  {
    name: '隐修者',
    text: '火、暗、神抗各 +10%；专精费用 −15%。静修留下了稳定的心志。',
    ...ordinary,
    resistance: 0.1,
    mastery: 0.85,
  },
] as const;
export function originEffect(h: Pick<Character, 'origin'>) {
  return (
    ORIGINS.find((o) => o.name === h.origin) ||
    (h.origin === '初代同行者'
      ? {
          ...ordinary,
          name: h.origin,
          text: '生命 +6%、攻击 +4%。开拓初日的同行经历。',
          hp: 1.06,
          attack: 1.04,
        }
      : {
          ...ordinary,
          name: h.origin,
          text: '这份旧手记中的出身没有专属加成。',
        })
  );
}
export function originHelp(h: Pick<Character, 'origin'>) {
  const o = originEffect(h);
  return {
    title: '出身 · ' + o.name,
    body:
      o.text +
      '\n出身加成计入角色面板与实际费用。属性百分比作用于装备加入后的个人数值；穿甲与三抗上限仍为75%，远程贡献上限100%。出身和潜力、资质独立抽取。',
  };
}
