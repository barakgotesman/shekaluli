import type { Profile, WeightEntry } from '../types';

// Standard WHO BMI thresholds
export const BMI_UNDERWEIGHT = 18.5;
export const BMI_NORMAL_MAX = 25;
export const BMI_OVERWEIGHT_MAX = 30;

/**
 * Converts a BMI value to the absolute weight (kg) that produces it at a given height.
 * Used to plot BMI thresholds as horizontal weight reference lines on the chart.
 * @param bmi - target BMI value
 * @param heightCm - person's height in centimeters
 * @returns weight in kilograms
 */
export function bmiToWeightKg(bmi: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return bmi * heightM * heightM;
}

/**
 * Computes BMI from weight and height.
 * @param weightKg - weight in kilograms
 * @param heightCm - height in centimeters
 * @returns BMI value
 */
export function weightToBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

/**
 * Maps a BMI value to its WHO weight category, in Hebrew.
 * @param bmi - BMI value
 * @returns category label
 */
export function bmiCategory(bmi: number): string {
  if (bmi < BMI_UNDERWEIGHT) return 'תת משקל';
  if (bmi < BMI_NORMAL_MAX) return 'משקל תקין';
  if (bmi < BMI_OVERWEIGHT_MAX) return 'עודף משקל';
  return 'השמנה';
}

/**
 * Computes the BMI for a single weight entry, given the user's height.
 * @param entry - the weight entry to compute BMI for
 * @param profile - user profile, providing height
 * @returns BMI value
 */
export function getEntryBmi(entry: WeightEntry, profile: Profile): number {
  return weightToBmi(entry.weightKg, profile.heightCm);
}

/**
 * Computes the BMI for the most recent weight entry.
 * @param entries - date-sorted (ascending) weight entries
 * @param profile - user profile, providing height
 * @returns BMI of the latest entry, or null if there are no entries
 */
export function getLatestBmi(entries: WeightEntry[], profile: Profile): number | null {
  const latest = entries[entries.length - 1];
  return latest ? getEntryBmi(latest, profile) : null;
}
