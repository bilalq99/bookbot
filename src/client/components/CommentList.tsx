// PLACEHOLDER — owned by agent C2 (client-feed). Replace entirely; keep the
// default export and props EXACTLY. Oldest-first list w/ "load more" cursor,
// composer pinned at the bottom (Enter submits), delete for own comments or on
// own workout, onCountChange(+1/-1) so the detail page can update counts.
export interface CommentListProps {
  workoutId: number
  workoutOwnerId: number
  onCountChange?: (delta: number) => void
}

export default function CommentList(_props: CommentListProps) {
  return null
}
