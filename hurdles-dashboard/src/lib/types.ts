export type Intensity = "High" | "Medium" | "Low";

export type SessionType = "Hurdles" | "Speed" | "Tempo" | "Gym" | "Recovery" | "Other";

export type Recurrence = "weekly" | null;

export interface Session {
  id: string;
  user_id: string;
  date: string;          // YYYY-MM-DD
  start_time: string | null;
  session_type: SessionType;
  intensity: Intensity;
  title: string;
  planned_notes: string | null;
  actual_notes: string | null;
  completed: boolean;
  recurrence: Recurrence;
  recurrence_until: string | null;
  created_at?: string;
}

export interface SessionInput {
  date: string;
  start_time: string | null;
  session_type: SessionType;
  intensity: Intensity;
  title: string;
  planned_notes: string | null;
  actual_notes: string | null;
  completed: boolean;
  recurrence: Recurrence;
  recurrence_until: string | null;
}

export interface Split {
  id: string;
  user_id: string;
  date: string;
  distance: 10 | 20 | 30;
  best_time: number;
  avg_time: number;
  notes: string | null;
}

export interface Weight {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
}

export const SESSION_TYPES: SessionType[] = [
  "Hurdles",
  "Speed",
  "Tempo",
  "Gym",
  "Recovery",
  "Other",
];

export const INTENSITIES: Intensity[] = ["High", "Medium", "Low"];

export const intensityColor: Record<Intensity, string> = {
  High: "#ef4444",
  Medium: "#f59e0b",
  Low: "#10b981",
};

export type ProgramFileType = "pdf" | "xlsx" | "docx";

export interface Program {
  id: string;
  user_id: string;
  name: string;
  file_path: string;
  file_type: ProgramFileType;
  file_size: number;
  uploaded_at: string;
}

export const ACCEPTED_PROGRAM_TYPES: Record<ProgramFileType, string> = {
  pdf:  "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
