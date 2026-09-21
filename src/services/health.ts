import { initialize, requestPermission, readRecords } from 'react-native-health-connect';
import type { ActivityDay } from '@/types';
import { upsertActivityDay } from '@/db/database';

const permissions = [
  { accessType: 'read' as const, recordType: 'ActiveCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'TotalCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'Steps' as const },
  { accessType: 'read' as const, recordType: 'ExerciseSession' as const },
  { accessType: 'read' as const, recordType: 'Weight' as const },
];

const dayKey = (d: Date) => d.toISOString().slice(0,10);

export async function connectHealthConnect() {
  const ok = await initialize();
  if (!ok) throw new Error('Health Connect is not available on this device.');
  return requestPermission(permissions as any);
}

export async function importHealthDays(days = 30): Promise<ActivityDay[]> {
  await initialize();
  const end = new Date();
  const start = new Date(); start.setDate(end.getDate() - days + 1); start.setHours(0,0,0,0);
  const filter = { timeRangeFilter: { operator:'between' as const, startTime:start.toISOString(), endTime:end.toISOString() } };
  const [active,total,steps,exercise] = await Promise.all([
    readRecords('ActiveCaloriesBurned', filter as any),
    readRecords('TotalCaloriesBurned', filter as any),
    readRecords('Steps', filter as any),
    readRecords('ExerciseSession', filter as any),
  ]);
  const map = new Map<string, ActivityDay>();
  for (let i=0;i<days;i++) { const d=new Date(start); d.setDate(start.getDate()+i); const key=dayKey(d); map.set(key,{date:key,activeCalories:0,totalCalories:0,steps:0,exerciseMinutes:0}); }
  for (const r of active.records as any[]) { const k=dayKey(new Date(r.startTime)); const x=map.get(k); if(x) x.activeCalories += r.energy?.inKilocalories ?? 0; }
  for (const r of total.records as any[]) { const k=dayKey(new Date(r.startTime)); const x=map.get(k); if(x) x.totalCalories += r.energy?.inKilocalories ?? 0; }
  for (const r of steps.records as any[]) { const k=dayKey(new Date(r.startTime)); const x=map.get(k); if(x) x.steps += r.count ?? 0; }
  for (const r of exercise.records as any[]) { const k=dayKey(new Date(r.startTime)); const x=map.get(k); if(x) x.exerciseMinutes += (new Date(r.endTime).getTime()-new Date(r.startTime).getTime())/60000; }
  const values=[...map.values()];
  for (const x of values) await upsertActivityDay(x);
  return values;
}