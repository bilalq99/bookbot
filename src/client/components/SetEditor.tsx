// PLACEHOLDER — owned by agent C3 (client-log-profile). Replace entirely; keep the
// default export and props EXACTLY (LogWorkoutPage renders one per exercise block).
// Set table with columns per metricType (docs/SPEC.md §10): SET · PREV · inputs · ✓.
// prev: last session's sets for this exercise (ghost placeholders). ✓ marks a row
// complete and calls onSetCompleted (fires the rest timer). Warm-up toggle per row;
// add set copies the previous row; inputs are in the viewer's unit (convert to kg
// in the page before POST). Prefix: .log-
import type { MetricType, SetIn } from '../../shared/types'

export interface EditableSet extends SetIn {
  completed?: boolean
}

export interface SetEditorProps {
  metricType: MetricType
  sets: EditableSet[]
  prev: SetIn[] | null
  onChange: (sets: EditableSet[]) => void
  onSetCompleted: () => void
}

export default function SetEditor(_props: SetEditorProps) {
  return null
}
