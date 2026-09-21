export type GoalType = 'lean_gain' | 'maintain' | 'fat_loss';

export type Profile = {
  id: number;
  name: string;
  age: number;
  sex: 'male' | 'female';
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  goalType: GoalType;
  weeklyRateKg: number;
  caloriesTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
};

export type Meal = {
  id?: number;
  eatenAt: string;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: 'text' | 'image' | 'manual';
};

export type ActivityDay = {
  date: string;
  activeCalories: number;
  totalCalories: number;
  steps: number;
  exerciseMinutes: number;
};

export type FoodEstimate = {
  title: string;
  confidence: 'low' | 'medium' | 'high';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  items: Array<{ name: string; grams?: number; calories: number; protein: number; carbs: number; fat: number }>;
};