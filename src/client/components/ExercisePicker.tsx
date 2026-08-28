// PLACEHOLDER — owned by agent C3 (client-log-profile). Replace entirely; keep the
// default export and props EXACTLY. Full-screen sheet: debounced fuzzy search over
// api.exercises(q), muscle + equipment filter chips, Recent section (from viewer's
// recent workouts via localStorage or last drafts), "Create '<query>'" row opening
// an inline custom-exercise form (api.createExercise). Prefix: .log-
import type { Exercise } from '../../shared/types'

export interface ExercisePickerProps {
  onPick: (exercise: Exercise) => void
  onClose: () => void
}

export default function ExercisePicker(_props: ExercisePickerProps) {
  return null
}
