// FROZEN CONTRACT — do not edit. The 77-exercise global library (domain spec).
// Slugs are stable identifiers; PRs and history key off them via exercise ids.
import type { Discipline, Equipment, MetricType, MuscleGroup, PlLift } from '../../shared/types'

export interface LibraryExercise {
  slug: string
  name: string
  metricType: MetricType
  muscleGroup: MuscleGroup
  equipment: Equipment
  plLift?: PlLift
  tags: Discipline[]
}

const WR = 'weight_reps' as const
const BW = 'bodyweight_reps' as const
const T = 'duration' as const
const D = 'distance_duration' as const

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  // ---- Barbell — powerlifting / general (15)
  { slug: 'back-squat', name: 'Back Squat', metricType: WR, muscleGroup: 'quads', equipment: 'barbell', plLift: 'S', tags: ['powerlifting', 'general'] },
  { slug: 'front-squat', name: 'Front Squat', metricType: WR, muscleGroup: 'quads', equipment: 'barbell', tags: ['weightlifting', 'powerlifting'] },
  { slug: 'bench-press', name: 'Bench Press', metricType: WR, muscleGroup: 'chest', equipment: 'barbell', plLift: 'B', tags: ['powerlifting', 'general'] },
  { slug: 'close-grip-bench-press', name: 'Close-Grip Bench Press', metricType: WR, muscleGroup: 'triceps', equipment: 'barbell', tags: ['powerlifting', 'bodybuilding'] },
  { slug: 'deadlift', name: 'Deadlift', metricType: WR, muscleGroup: 'back', equipment: 'barbell', plLift: 'D', tags: ['powerlifting', 'general'] },
  { slug: 'sumo-deadlift', name: 'Sumo Deadlift', metricType: WR, muscleGroup: 'glutes', equipment: 'barbell', plLift: 'D', tags: ['powerlifting'] },
  { slug: 'romanian-deadlift', name: 'Romanian Deadlift', metricType: WR, muscleGroup: 'hamstrings', equipment: 'barbell', tags: ['bodybuilding', 'powerlifting'] },
  { slug: 'overhead-press', name: 'Overhead Press', metricType: WR, muscleGroup: 'shoulders', equipment: 'barbell', tags: ['general', 'powerlifting'] },
  { slug: 'push-press', name: 'Push Press', metricType: WR, muscleGroup: 'shoulders', equipment: 'barbell', tags: ['weightlifting', 'strongman'] },
  { slug: 'barbell-row', name: 'Barbell Row', metricType: WR, muscleGroup: 'back', equipment: 'barbell', tags: ['bodybuilding', 'powerlifting'] },
  { slug: 'hip-thrust', name: 'Hip Thrust', metricType: WR, muscleGroup: 'glutes', equipment: 'barbell', tags: ['bodybuilding'] },
  { slug: 'good-morning', name: 'Good Morning', metricType: WR, muscleGroup: 'hamstrings', equipment: 'barbell', tags: ['powerlifting'] },
  { slug: 'barbell-curl', name: 'Barbell Curl', metricType: WR, muscleGroup: 'biceps', equipment: 'barbell', tags: ['bodybuilding'] },
  { slug: 'ez-bar-skull-crusher', name: 'EZ-Bar Skull Crusher', metricType: WR, muscleGroup: 'triceps', equipment: 'barbell', tags: ['bodybuilding'] },
  { slug: 'barbell-shrug', name: 'Barbell Shrug', metricType: WR, muscleGroup: 'traps', equipment: 'barbell', tags: ['bodybuilding'] },
  // ---- Barbell — weightlifting (5)
  { slug: 'snatch', name: 'Snatch', metricType: WR, muscleGroup: 'full_body', equipment: 'barbell', tags: ['weightlifting'] },
  { slug: 'clean-and-jerk', name: 'Clean & Jerk', metricType: WR, muscleGroup: 'full_body', equipment: 'barbell', tags: ['weightlifting'] },
  { slug: 'power-snatch', name: 'Power Snatch', metricType: WR, muscleGroup: 'full_body', equipment: 'barbell', tags: ['weightlifting'] },
  { slug: 'power-clean', name: 'Power Clean', metricType: WR, muscleGroup: 'full_body', equipment: 'barbell', tags: ['weightlifting', 'general'] },
  { slug: 'overhead-squat', name: 'Overhead Squat', metricType: WR, muscleGroup: 'quads', equipment: 'barbell', tags: ['weightlifting'] },
  // ---- Dumbbell (10)
  { slug: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', metricType: WR, muscleGroup: 'chest', equipment: 'dumbbell', tags: ['bodybuilding'] },
  { slug: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', metricType: WR, muscleGroup: 'chest', equipment: 'dumbbell', tags: ['bodybuilding'] },
  { slug: 'dumbbell-row', name: 'Dumbbell Row', metricType: WR, muscleGroup: 'back', equipment: 'dumbbell', tags: ['bodybuilding'] },
  { slug: 'dumbbell-shoulder-press', name: 'Dumbbell Shoulder Press', metricType: WR, muscleGroup: 'shoulders', equipment: 'dumbbell', tags: ['bodybuilding'] },
  { slug: 'dumbbell-lateral-raise', name: 'Dumbbell Lateral Raise', metricType: WR, muscleGroup: 'shoulders', equipment: 'dumbbell', tags: ['bodybuilding'] },
  { slug: 'dumbbell-curl', name: 'Dumbbell Curl', metricType: WR, muscleGroup: 'biceps', equipment: 'dumbbell', tags: ['bodybuilding'] },
  { slug: 'hammer-curl', name: 'Hammer Curl', metricType: WR, muscleGroup: 'biceps', equipment: 'dumbbell', tags: ['bodybuilding'] },
  { slug: 'dumbbell-romanian-deadlift', name: 'Dumbbell Romanian Deadlift', metricType: WR, muscleGroup: 'hamstrings', equipment: 'dumbbell', tags: ['bodybuilding'] },
  { slug: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', metricType: WR, muscleGroup: 'quads', equipment: 'dumbbell', tags: ['bodybuilding', 'calisthenics'] },
  { slug: 'goblet-squat', name: 'Goblet Squat', metricType: WR, muscleGroup: 'quads', equipment: 'dumbbell', tags: ['general'] },
  // ---- Machine (8)
  { slug: 'leg-press', name: 'Leg Press', metricType: WR, muscleGroup: 'quads', equipment: 'machine', tags: ['bodybuilding'] },
  { slug: 'hack-squat', name: 'Hack Squat', metricType: WR, muscleGroup: 'quads', equipment: 'machine', tags: ['bodybuilding'] },
  { slug: 'leg-extension', name: 'Leg Extension', metricType: WR, muscleGroup: 'quads', equipment: 'machine', tags: ['bodybuilding'] },
  { slug: 'seated-leg-curl', name: 'Seated Leg Curl', metricType: WR, muscleGroup: 'hamstrings', equipment: 'machine', tags: ['bodybuilding'] },
  { slug: 'chest-press-machine', name: 'Chest Press Machine', metricType: WR, muscleGroup: 'chest', equipment: 'machine', tags: ['bodybuilding'] },
  { slug: 'pec-deck-fly', name: 'Pec Deck Fly', metricType: WR, muscleGroup: 'chest', equipment: 'machine', tags: ['bodybuilding'] },
  { slug: 'machine-row', name: 'Machine Row', metricType: WR, muscleGroup: 'back', equipment: 'machine', tags: ['bodybuilding'] },
  { slug: 'standing-calf-raise', name: 'Standing Calf Raise', metricType: WR, muscleGroup: 'calves', equipment: 'machine', tags: ['bodybuilding'] },
  // ---- Cable (7)
  { slug: 'lat-pulldown', name: 'Lat Pulldown', metricType: WR, muscleGroup: 'back', equipment: 'cable', tags: ['bodybuilding', 'general'] },
  { slug: 'seated-cable-row', name: 'Seated Cable Row', metricType: WR, muscleGroup: 'back', equipment: 'cable', tags: ['bodybuilding'] },
  { slug: 'triceps-pushdown', name: 'Triceps Pushdown', metricType: WR, muscleGroup: 'triceps', equipment: 'cable', tags: ['bodybuilding'] },
  { slug: 'cable-curl', name: 'Cable Curl', metricType: WR, muscleGroup: 'biceps', equipment: 'cable', tags: ['bodybuilding'] },
  { slug: 'cable-fly', name: 'Cable Fly', metricType: WR, muscleGroup: 'chest', equipment: 'cable', tags: ['bodybuilding'] },
  { slug: 'face-pull', name: 'Face Pull', metricType: WR, muscleGroup: 'shoulders', equipment: 'cable', tags: ['bodybuilding', 'general'] },
  { slug: 'cable-crunch', name: 'Cable Crunch', metricType: WR, muscleGroup: 'core', equipment: 'cable', tags: ['bodybuilding'] },
  // ---- Kettlebell (5)
  { slug: 'kettlebell-swing', name: 'Kettlebell Swing', metricType: WR, muscleGroup: 'glutes', equipment: 'kettlebell', tags: ['general'] },
  { slug: 'turkish-get-up', name: 'Turkish Get-Up', metricType: WR, muscleGroup: 'full_body', equipment: 'kettlebell', tags: ['general'] },
  { slug: 'kettlebell-snatch', name: 'Kettlebell Snatch', metricType: WR, muscleGroup: 'full_body', equipment: 'kettlebell', tags: ['general'] },
  { slug: 'kettlebell-clean-and-press', name: 'Kettlebell Clean & Press', metricType: WR, muscleGroup: 'shoulders', equipment: 'kettlebell', tags: ['general'] },
  { slug: 'kettlebell-front-rack-carry', name: 'Kettlebell Front-Rack Carry', metricType: D, muscleGroup: 'core', equipment: 'kettlebell', tags: ['general', 'strongman'] },
  // ---- Odd-implement / strongman (10)
  { slug: 'farmers-carry', name: "Farmer's Carry", metricType: D, muscleGroup: 'forearms', equipment: 'odd_implement', tags: ['strongman'] },
  { slug: 'yoke-walk', name: 'Yoke Walk', metricType: D, muscleGroup: 'full_body', equipment: 'odd_implement', tags: ['strongman'] },
  { slug: 'sandbag-carry', name: 'Sandbag Carry', metricType: D, muscleGroup: 'full_body', equipment: 'odd_implement', tags: ['strongman'] },
  { slug: 'sled-push', name: 'Sled Push', metricType: D, muscleGroup: 'quads', equipment: 'odd_implement', tags: ['strongman', 'general'] },
  { slug: 'sled-drag', name: 'Sled Drag', metricType: D, muscleGroup: 'hamstrings', equipment: 'odd_implement', tags: ['strongman'] },
  { slug: 'atlas-stone-load', name: 'Atlas Stone Load', metricType: WR, muscleGroup: 'full_body', equipment: 'odd_implement', tags: ['strongman'] },
  { slug: 'log-press', name: 'Log Press', metricType: WR, muscleGroup: 'shoulders', equipment: 'odd_implement', tags: ['strongman'] },
  { slug: 'axle-deadlift', name: 'Axle Deadlift', metricType: WR, muscleGroup: 'back', equipment: 'odd_implement', tags: ['strongman'] },
  { slug: 'circus-dumbbell-press', name: 'Circus Dumbbell Press', metricType: WR, muscleGroup: 'shoulders', equipment: 'odd_implement', tags: ['strongman'] },
  { slug: 'tire-flip', name: 'Tire Flip', metricType: WR, muscleGroup: 'full_body', equipment: 'odd_implement', tags: ['strongman'] },
  // ---- Bodyweight / calisthenics (17)
  { slug: 'pull-up', name: 'Pull-Up', metricType: BW, muscleGroup: 'back', equipment: 'bodyweight', tags: ['calisthenics', 'general'] },
  { slug: 'chin-up', name: 'Chin-Up', metricType: BW, muscleGroup: 'biceps', equipment: 'bodyweight', tags: ['calisthenics'] },
  { slug: 'dip', name: 'Dip', metricType: BW, muscleGroup: 'chest', equipment: 'bodyweight', tags: ['calisthenics', 'general'] },
  { slug: 'push-up', name: 'Push-Up', metricType: BW, muscleGroup: 'chest', equipment: 'bodyweight', tags: ['calisthenics', 'general'] },
  { slug: 'muscle-up', name: 'Muscle-Up', metricType: BW, muscleGroup: 'back', equipment: 'bodyweight', tags: ['calisthenics'] },
  { slug: 'handstand-push-up', name: 'Handstand Push-Up', metricType: BW, muscleGroup: 'shoulders', equipment: 'bodyweight', tags: ['calisthenics'] },
  { slug: 'pistol-squat', name: 'Pistol Squat', metricType: BW, muscleGroup: 'quads', equipment: 'bodyweight', tags: ['calisthenics'] },
  { slug: 'nordic-hamstring-curl', name: 'Nordic Hamstring Curl', metricType: BW, muscleGroup: 'hamstrings', equipment: 'bodyweight', tags: ['calisthenics', 'general'] },
  { slug: 'inverted-row', name: 'Inverted Row', metricType: BW, muscleGroup: 'back', equipment: 'bodyweight', tags: ['calisthenics'] },
  { slug: 'ab-wheel-rollout', name: 'Ab Wheel Rollout', metricType: BW, muscleGroup: 'core', equipment: 'bodyweight', tags: ['general'] },
  { slug: 'hanging-leg-raise', name: 'Hanging Leg Raise', metricType: BW, muscleGroup: 'core', equipment: 'bodyweight', tags: ['calisthenics', 'bodybuilding'] },
  { slug: 'back-extension', name: 'Back Extension', metricType: BW, muscleGroup: 'back', equipment: 'bodyweight', tags: ['general'] },
  { slug: 'plank', name: 'Plank', metricType: T, muscleGroup: 'core', equipment: 'bodyweight', tags: ['general'] },
  { slug: 'l-sit', name: 'L-Sit', metricType: T, muscleGroup: 'core', equipment: 'bodyweight', tags: ['calisthenics'] },
  { slug: 'handstand-hold', name: 'Handstand Hold', metricType: T, muscleGroup: 'shoulders', equipment: 'bodyweight', tags: ['calisthenics'] },
  { slug: 'front-lever-hold', name: 'Front Lever Hold', metricType: T, muscleGroup: 'back', equipment: 'bodyweight', tags: ['calisthenics'] },
  { slug: 'dead-hang', name: 'Dead Hang', metricType: T, muscleGroup: 'forearms', equipment: 'bodyweight', tags: ['calisthenics', 'general'] },
]
