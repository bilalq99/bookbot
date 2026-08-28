// PLACEHOLDER — owned by agent C1 (client-shell). Replace entirely; keep the
// default export. Layout route: MUST render <Outlet /> for child pages.
// Mobile (<900px): bottom tab bar — Feed / Discover / Log (raised plate-red FAB) /
// Records / You(avatar). Desktop (>=900px): left icon rail; content column centered
// max-width var(--content-w). Feed header carries the CHALK wordmark + bell icon
// with unread badge (poll api.notifications() every 60s here). See docs/SPEC.md §10.
import { Outlet } from 'react-router-dom'

export default function AppShell() {
  return <Outlet />
}
