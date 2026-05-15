import { Construction, Zap, Target, Dumbbell, Wind, ClipboardList } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SessionType } from "./types";

export const SESSION_ICONS: Record<SessionType, LucideIcon> = {
  Hurdles: Construction,
  Speed: Zap,
  Tempo: Target,
  Gym: Dumbbell,
  Recovery: Wind,
  Other: ClipboardList,
};
