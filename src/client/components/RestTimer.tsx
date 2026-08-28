// PLACEHOLDER — owned by agent C3 (client-log-profile). Replace entirely; keep the
// default export and props EXACTLY. Compact bar docked above the tab bar:
// countdown ring/number from `seconds` (default 90), +30s and Skip buttons,
// onDone when it hits zero or is skipped. Restart when `runId` changes.
export interface RestTimerProps {
  runId: number // increment to (re)start the timer
  seconds?: number
  onDone: () => void
}

export default function RestTimer(_props: RestTimerProps) {
  return null
}
