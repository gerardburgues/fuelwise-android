import * as SecureStore from 'expo-secure-store';
import type { FoodEstimate, Meal, Profile, ActivityDay } from '@/types';

const KEY = 'openai_api_key';
const MODEL = 'gpt-5.6-luna';

export const OpenAIKeyStore = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (value: string) => SecureStore.setItemAsync(KEY, value),
  remove: () => SecureStore.deleteItemAsync(KEY),
};

async function callOpenAI(input: any, instructions?: string) {
  const apiKey = await OpenAIKeyStore.get();
  if (!apiKey) throw new Error('Add your OpenAI API key in Settings first.');
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, instructions, input, text: { format: { type: 'json_object' } } }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.output_text as string;
}

export async function estimateFoodFromText(description: string): Promise<FoodEstimate> {
  const raw = await callOpenAI(description, `You are a nutrition logging assistant. Estimate realistic portions and nutrition from the user's meal description. Return ONLY valid JSON with keys: title, confidence (low|medium|high), calories, protein, carbs, fat, items. items is an array of {name, grams, calories, protein, carbs, fat}. Values are numbers. Prefer conservative uncertainty rather than false precision.`);
  return JSON.parse(raw);
}

export async function estimateFoodFromImage(base64: string, description?: string): Promise<FoodEstimate> {
  const content = [
    { type: 'input_text', text: description || 'Estimate the foods and portions in this image.' },
    { type: 'input_image', image_url: `data:image/jpeg;base64,${base64}` },
  ];
  const raw = await callOpenAI([{ role: 'user', content }], `Analyze a meal photo for calorie and macro logging. Return ONLY valid JSON with keys: title, confidence (low|medium|high), calories, protein, carbs, fat, items. items is an array of {name, grams, calories, protein, carbs, fat}. Use realistic portion estimates and account for likely oils/sauces, but communicate uncertainty through confidence.`);
  return JSON.parse(raw);
}

export async function askCoach(question: string, ctx: { profile: Profile; meals: Meal[]; activity: ActivityDay | null }) {
  const eaten = ctx.meals.reduce((a,m)=>({ calories:a.calories+m.calories, protein:a.protein+m.protein, carbs:a.carbs+m.carbs, fat:a.fat+m.fat }), {calories:0,protein:0,carbs:0,fat:0});
  const remaining = {
    calories: Math.max(0, ctx.profile.caloriesTarget - eaten.calories),
    protein: Math.max(0, ctx.profile.proteinTarget - eaten.protein),
    carbs: Math.max(0, ctx.profile.carbsTarget - eaten.carbs),
    fat: Math.max(0, ctx.profile.fatTarget - eaten.fat),
  };
  const prompt = { question, goal: ctx.profile.goalType, body: {weightKg:ctx.profile.weightKg,targetWeightKg:ctx.profile.targetWeightKg,heightCm:ctx.profile.heightCm}, targets:{calories:ctx.profile.caloriesTarget,protein:ctx.profile.proteinTarget,carbs:ctx.profile.carbsTarget,fat:ctx.profile.fatTarget}, eaten, remaining, activity:ctx.activity, meals:ctx.meals };
  const raw = await callOpenAI(JSON.stringify(prompt), `You are Fuelwise, a concise evidence-aware nutrition coach. The user's goal is primarily muscle gain while staying lean unless context says otherwise. Use the supplied intake and activity data. Do not pretend wearable calorie burn is exact. Give actionable meal advice with approximate calories and protein. Return ONLY JSON: {"answer":"..."}.`);
  return JSON.parse(raw).answer as string;
}