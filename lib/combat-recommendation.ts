import { BOSSES, GUARDIANS, type Element } from './guardian-candidates.ts';
import type { GearSlot } from './guild-data.ts';

/** The attainable reference build used by both the preparation UI and combat checks.
 * These are preparation targets, never entry requirements or enemy scaling inputs. */
export interface CombatRecommendation {
  count: number;
  quality: number;
  level: number;
  tier: number;
  rarity: number;
  upgrade: number;
  mastery: number;
  kit: number;
  smithing: number;
  slots: GearSlot[];
  element: Element;
  stance: 'cautious';
  remedy: boolean;
  research: string[];
  tech: string[];
  roles: string[];
  origin: string;
  talent: string;
  skillBranch: 'a';
  skillText: string;
}

export function combatRecommendation(region: number, node: number): CombatRecommendation {
  const enemy = node === 6 ? BOSSES[region] : GUARDIANS.find(e => e.region === region && e.node === node);
  if (!enemy) throw new RangeError('Unknown encounter');
  const tech: string[] = [];
  if (region || node > 1) tech.push('settlement');
  if (region === 1 && node > 1) tech.push('runecraft');
  if (region === 2 && node > 1) tech.push('metallurgy');
  if (region >= 3) tech.push('metallurgy', 'runecraft');
  if (region === 3 || region === 4 && node > 1 || region === 5) tech.push('citadel');
  if (region === 3 && node > 2 || region === 5) tech.push('infernalcraft');
  if (region === 4 && node > 2 || region === 5) tech.push('dragoncraft');
  if (region === 5 && node > 1) tech.push('mythic');
  const rank = tech.includes('mythic') ? 5 : tech.some(t => ['infernalcraft','dragoncraft'].includes(t)) ? 4 : tech.includes('citadel') ? 3 : tech.some(t => ['runecraft','metallurgy'].includes(t)) ? 2 : tech.length ? 1 : 0;
  const research = [...(tech.includes('metallurgy') ? ['steel'] : []), ...(tech.includes('runecraft') ? ['wards'] : []), ...(rank >= 4 ? ['memory'] : []), ...(rank >= 5 ? ['godslayer'] : [])];
  return {
    count: 4, quality: region < 3 ? 2 : 3,
    level: enemy.targetLevel, tier: enemy.targetTier,
    rarity: node === 6 || region === 0 && node >= 4 || region === 2 && (node === 1 || node === 5) || region === 4 && node === 2 ? 3 : 2,
    upgrade: enemy.targetUpgrade, mastery: rank < 2 ? 0 : Math.min(3, rank - 1),
    kit: rank, smithing: rank === 0 ? 0 : rank === 1 ? Math.max(0, node - 3) : node === 6 ? Math.min(4, rank + 1) : Math.min(4, rank - 1 + (node >= 4 ? 1 : 0)),
    slots: region === 0 && node === 1 ? ['weapon','armor','charm'] : ['weapon','armor','charm','head','hands','feet'],
    element: enemy.element, stance: 'cautious', remedy: false, research, tech,
    roles: ['rhea','finn','luna','kael'], skillBranch: 'a',
    origin: '行商护卫', talent: 'diligent',
    skillText: enemy.targetLevel < 5 ? '基础技能：防护、治疗、输出配合' : '使用已获得技能点，优先一条分支；带上防护、治疗与打断',
  };
}
