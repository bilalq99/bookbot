// PLACEHOLDER — owned by agent C2 (client-feed). Replace entirely; keep the
// default export and props EXACTLY. Feed post: header (Avatar, name -> profile,
// relative time), hero (photo carousel if media else SessionCard; double-tap/click
// bumps with a burst), stat row, exercise strip ("Bench 8×80 · Squat … +2 more"),
// actions: Bump (optimistic toggle, count), Comment (-> /s/:id), PR chip.
// onChange bubbles updated card state (like count) to the parent list.
import type { WorkoutCard } from '../../shared/types'

export interface FeedItemProps {
  workout: WorkoutCard
  onChange?: (updated: WorkoutCard) => void
}

export default function FeedItem(_props: FeedItemProps) {
  return null
}
