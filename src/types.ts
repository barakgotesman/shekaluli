export interface Profile {
  name: string;
  gender: 'male' | 'female';
  birthDate: string; // YYYY-MM-DD
  heightCm: number;
  startWeightKg: number;
  goalWeightKg: number;
  photoBase64?: string;
}

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weightKg: number;
  note?: string;
}
