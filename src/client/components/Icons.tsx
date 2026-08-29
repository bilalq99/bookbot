// Inline SVG icon set — no icon dependency. 24px grid, stroke currentColor.
import type { ReactNode } from 'react'

export interface IconProps {
  size?: number
  className?: string
}

function icon(children: ReactNode, filled = false) {
  return function Icon({ size = 24, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? 'currentColor' : 'none'}
        stroke={filled ? 'none' : 'currentColor'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {children}
      </svg>
    )
  }
}

export const IconHome = icon(
  <>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M10 21v-6h4v6" />
  </>,
)

export const IconSearch = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20.5 20.5-4.6-4.6" />
  </>,
)

export const IconPlus = icon(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
)

export const IconTrophy = icon(
  <>
    <path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" />
    <path d="M8 5H4.5a0 0 0 0 0 0 0c0 3 1.5 5 3.5 5" />
    <path d="M16 5h3.5c0 3-1.5 5-3.5 5" />
    <path d="M12 14v4" />
    <path d="M8 21h8" />
    <path d="M10 21c0-2 .5-3 2-3s2 1 2 3" />
  </>,
)

export const IconUser = icon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
  </>,
)

export const IconBell = icon(
  <>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </>,
)

/** The fist bump — Chalk's like. */
export const IconFist = icon(
  <>
    <path d="M7 11V8.5A1.5 1.5 0 0 1 8.5 7H10" />
    <path d="M10 10V6.5A1.5 1.5 0 0 1 11.5 5h.5A1.5 1.5 0 0 1 13.5 6.5V10" />
    <path d="M13.5 10V7a1.5 1.5 0 0 1 3 0v3" />
    <path d="M16.5 10.5V9a1.5 1.5 0 0 1 3 0v5.5a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6V11a1.5 1.5 0 0 1 3 0" />
    <path d="M7 13.5h4" />
  </>,
)

export const IconComment = icon(
  <path d="M21 12a8 8 0 0 1-8 8H4l2.5-2.7A8 8 0 1 1 21 12Z" />,
)

export const IconClock = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </>,
)

export const IconFlame = icon(
  <path d="M12 21c-4 0-6.5-2.6-6.5-6 0-2.6 1.6-4.6 3-6.2C9.8 7.3 11 5.7 11 3c3.5 2 4.6 4.6 4.3 7 1.2-.4 2-1.3 2.3-2.5 1.2 1.7 1.9 3.7 1.9 5.5 0 5-3.2 8-7.5 8Z" />,
)

export const IconCheck = icon(<path d="m4.5 12.5 5 5 10-11" />)

export const IconX = icon(
  <>
    <path d="m5 5 14 14" />
    <path d="M19 5 5 19" />
  </>,
)

export const IconTrash = icon(
  <>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 14h10l1-14" />
  </>,
)

export const IconDots = icon(
  <>
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </>,
)

export const IconChevronLeft = icon(<path d="m14.5 5-7 7 7 7" />)

export const IconEdit = icon(
  <>
    <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </>,
)

export const IconLogout = icon(
  <>
    <path d="M14 4H6v16h8" />
    <path d="M10 12h10" />
    <path d="m16.5 8.5 3.5 3.5-3.5 3.5" />
  </>,
)

export const IconBarbell = icon(
  <>
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <rect x="4" y="8" width="2.5" height="8" rx="1" />
    <rect x="17.5" y="8" width="2.5" height="8" rx="1" />
    <path d="M6.5 12h11" />
  </>,
)
