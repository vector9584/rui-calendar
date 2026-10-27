import type { JSX } from 'react'
import {
  Mountain,
  Bike,
  Coffee,
  Plane,
  Cake,
  PartyPopper,
  Dumbbell,
  Footprints,
  Music,
  Utensils,
  ChefHat,
  Beer,
  Wine,
  Palmtree,
  Snowflake,
  Fish,
  Sprout,
  Users,
  Phone,
  Briefcase,
  GraduationCap,
  BookOpen,
  Stethoscope,
  ShoppingCart,
  Gift,
  Car,
  TrainFront,
  Clapperboard,
  Gamepad2,
  Trophy,
  Scissors,
  Dog,
  Baby,
  Heart,
  WashingMachine,
  Camera,
  Palette,
  Wallet,
  Church,
  type LucideIcon,
} from 'lucide-react'
import type { EventBackgroundId } from '@/lib/eventBackground'

/**
 * Decorative icons keyed by {@link EventBackgroundId}, drawn from the Lucide
 * line-icon set. Icons are square and self-centered on a 24×24 grid in
 * `currentColor`, so positioning/opacity is left entirely to the caller's CSS.
 */
const SCENES: Record<EventBackgroundId, LucideIcon> = {
  mountain: Mountain,
  bike: Bike,
  coffee: Coffee,
  plane: Plane,
  cake: Cake,
  party: PartyPopper,
  gym: Dumbbell,
  run: Footprints,
  music: Music,
  food: Utensils,
  cooking: ChefHat,
  drinks: Beer,
  wine: Wine,
  beach: Palmtree,
  snow: Snowflake,
  fishing: Fish,
  garden: Sprout,
  meeting: Users,
  call: Phone,
  work: Briefcase,
  school: GraduationCap,
  reading: BookOpen,
  medical: Stethoscope,
  shopping: ShoppingCart,
  gift: Gift,
  car: Car,
  train: TrainFront,
  movie: Clapperboard,
  gaming: Gamepad2,
  sports: Trophy,
  haircut: Scissors,
  pet: Dog,
  baby: Baby,
  date: Heart,
  laundry: WashingMachine,
  photo: Camera,
  art: Palette,
  money: Wallet,
  church: Church,
}

interface EventBackgroundProps {
  id: EventBackgroundId
  className?: string
}

/**
 * Renders a decorative keyword icon. Sizing, positioning and opacity are
 * controlled entirely by the caller's CSS via `className`.
 */
export function EventBackground({ id, className }: EventBackgroundProps): JSX.Element {
  const Icon = SCENES[id]
  return <Icon className={className} aria-hidden="true" focusable="false" />
}
