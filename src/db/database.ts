import * as SQLite from 'expo-sqlite';
import type { Meal, Profile, ActivityDay } from '@/types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function db() {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync('fuelwise.db');
  return dbPromise;
}

export async function initDb() {
  const d = await db();
  await d.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK(id=1),
      name TEXT NOT NULL DEFAULT 'Gerard',
      age INTEGER NOT NULL DEFAULT 30,
      sex TEXT NOT NULL DEFAULT 'male',
      height_cm REAL NOT NULL DEFAULT 192,
      weight_kg REAL NOT NULL DEFAULT 90,
      target_weight_kg REAL NOT NULL DEFAULT 95,
      goal_type TEXT NOT NULL DEFAULT 'lean_gain',
      weekly_rate_kg REAL NOT NULL DEFAULT 0.15,
      calories_target INTEGER NOT NULL DEFAULT 3150,
      protein_target INTEGER NOT NULL DEFAULT 190,
      carbs_target INTEGER NOT NULL DEFAULT 405,
      fat_target INTEGER NOT NULL DEFAULT 85
    );
    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eaten_at TEXT NOT NULL,
      title TEXT NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      source TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS weights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      measured_at TEXT NOT NULL,
      weight_kg REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activity_days (
      date TEXT PRIMARY KEY,
      active_calories REAL NOT NULL DEFAULT 0,
      total_calories REAL NOT NULL DEFAULT 0,
      steps INTEGER NOT NULL DEFAULT 0,
      exercise_minutes REAL NOT NULL DEFAULT 0
    );
  `);
  await d.runAsync(`INSERT OR IGNORE INTO profile (id) VALUES (1)`);
}

export async function getProfile(): Promise<Profile> {
  const d = await db();
  const row = await d.getFirstAsync<any>('SELECT * FROM profile WHERE id=1');
  return {
    id: 1,
    name: row.name,
    age: row.age,
    sex: row.sex,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    targetWeightKg: row.target_weight_kg,
    goalType: row.goal_type,
    weeklyRateKg: row.weekly_rate_kg,
    caloriesTarget: row.calories_target,
    proteinTarget: row.protein_target,
    carbsTarget: row.carbs_target,
    fatTarget: row.fat_target,
  };
}

export async function saveProfile(p: Partial<Profile>) {
  const current = await getProfile();
  const x = { ...current, ...p };
  const d = await db();
  await d.runAsync(`UPDATE profile SET name=?, age=?, sex=?, height_cm=?, weight_kg=?, target_weight_kg=?, goal_type=?, weekly_rate_kg=?, calories_target=?, protein_target=?, carbs_target=?, fat_target=? WHERE id=1`,
    x.name, x.age, x.sex, x.heightCm, x.weightKg, x.targetWeightKg, x.goalType, x.weeklyRateKg, x.caloriesTarget, x.proteinTarget, x.carbsTarget, x.fatTarget);
}

export async function addMeal(meal: Meal) {
  const d = await db();
  await d.runAsync(`INSERT INTO meals (eaten_at,title,calories,protein,carbs,fat,source) VALUES (?,?,?,?,?,?,?)`,
    meal.eatenAt, meal.title, meal.calories, meal.protein, meal.carbs, meal.fat, meal.source);
}

export async function getMealsForDate(date: string): Promise<Meal[]> {
  const d = await db();
  const rows = await d.getAllAsync<any>(`SELECT * FROM meals WHERE substr(eaten_at,1,10)=? ORDER BY eaten_at ASC`, date);
  return rows.map(r => ({ id:r.id, eatenAt:r.eaten_at, title:r.title, calories:r.calories, protein:r.protein, carbs:r.carbs, fat:r.fat, source:r.source }));
}

export async function upsertActivityDay(a: ActivityDay) {
  const d = await db();
  await d.runAsync(`INSERT INTO activity_days(date,active_calories,total_calories,steps,exercise_minutes) VALUES(?,?,?,?,?)
  ON CONFLICT(date) DO UPDATE SET active_calories=excluded.active_calories,total_calories=excluded.total_calories,steps=excluded.steps,exercise_minutes=excluded.exercise_minutes`,
  a.date,a.activeCalories,a.totalCalories,a.steps,a.exerciseMinutes);
}

export async function getActivityDay(date: string): Promise<ActivityDay | null> {
  const d = await db();
  const r = await d.getFirstAsync<any>('SELECT * FROM activity_days WHERE date=?', date);
  return r ? { date:r.date, activeCalories:r.active_calories, totalCalories:r.total_calories, steps:r.steps, exerciseMinutes:r.exercise_minutes } : null;
}

export async function getActivityRange(startDate: string): Promise<ActivityDay[]> {
  const d = await db();
  const rows = await d.getAllAsync<any>('SELECT * FROM activity_days WHERE date>=? ORDER BY date ASC', startDate);
  return rows.map(r => ({ date:r.date, activeCalories:r.active_calories, totalCalories:r.total_calories, steps:r.steps, exerciseMinutes:r.exercise_minutes }));
}