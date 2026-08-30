// Initials on a deterministic gradient derived from the username.
export interface AvatarProps {
  username: string
  displayName?: string
  size?: number
}

function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return h >>> 0
}

export default function Avatar({ username, displayName, size = 40 }: AvatarProps) {
  const h = hash(username)
  const hue1 = h % 360
  const hue2 = (hue1 + 40 + (h % 60)) % 360
  const name = (displayName ?? username).trim()
  const parts = name.split(/\s+/)
  const initials =
    parts.length >= 2
      ? `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`
      : name.slice(0, 2)
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: `linear-gradient(135deg, hsl(${hue1} 45% 32%), hsl(${hue2} 55% 22%))`,
        color: 'var(--ink)',
        fontWeight: 700,
        fontSize: Math.max(10, Math.round(size * 0.38)),
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        userSelect: 'none',
      }}
    >
      {initials}
    </span>
  )
}
