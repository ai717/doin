import type { StampId } from "@/game/score";
import {
  Award,
  BadgeCheck,
  BookOpen,
  CalendarCheck,
  CalendarRange,
  Check,
  Droplet,
  EyeOff,
  Feather,
  Flame,
  Gauge,
  Gem,
  Lamp,
  Layers,
  Library,
  Moon,
  PenLine,
  Timer,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<StampId, LucideIcon> = {
  first: PenLine,
  daily: CalendarCheck,
  clean: Check,
  blind: EyeOff,
  five: Layers,
  streak3: Flame,
  streak7: Feather,
  month: Moon,
  ten: Library,
  fifty: BookOpen,
  hundred: Award,
  thick: Droplet,
  record: Timer,
  swift: Wind,
  expert: Gem,
  perfect: BadgeCheck,
  mediumFly: Gauge,
  streak30: CalendarRange,
  pour: Waves,
  night: Lamp,
};

export function StampIcon({
  id,
  className,
}: {
  id: StampId;
  className?: string;
}) {
  const Icon = ICONS[id];
  return <Icon className={className} strokeWidth={1.75} />;
}