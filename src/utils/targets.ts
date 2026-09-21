import type { ActivityDay, Profile } from '@/types';

export function calculateStartingTargets(profile: Profile, days: ActivityDay[]) {
  const valid = days.filter(d => d.totalCalories > 800);
  const avgBurn = valid.length ? valid.reduce((s,d)=>s+d.totalCalories,0)/valid.length : 2800;
  const surplus = profile.goalType === 'lean_gain' ? 250 : profile.goalType === 'fat_loss' ? -400 : 0;
  const calories = Math.round((avgBurn + surplus)/50)*50;
  const protein = Math.round(profile.weightKg * (profile.goalType === 'lean_gain' ? 2.0 : 1.8));
  const fat = Math.round(profile.weightKg * 0.9);
  const carbs = Math.max(0, Math.round((calories - protein*4 - fat*9)/4));
  return { calories, protein, fat, carbs, avgBurn: Math.round(avgBurn) };
}