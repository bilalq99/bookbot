// Public pages served at /privacy and /support — App Store Connect requires a
// privacy-policy URL and a support URL, so hosting the app provides both.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// TODO(operator): replace with a monitored address before App Store submission.
const CONTACT_EMAIL = 'support@example.com'

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="legal-wrap">
      <article className="legal-card">
        <Link className="legal-back" to="/">
          ← Chalk
        </Link>
        <h1 className="legal-title">{title}</h1>
        {children}
        <p className="legal-foot">
          Questions? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </article>
    </div>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p className="legal-updated">Last updated: August 29, 2026</p>

      <h2>What Chalk collects</h2>
      <p>
        <strong>Account information.</strong> A username, an optional display name and bio, and your unit
        preference (kg/lb). Your password is stored only as a salted bcrypt hash — never in plain text.
      </p>
      <p>
        <strong>Content you create.</strong> Workouts (exercises, sets, weights, notes, titles), photos you
        attach to sessions, comments, fist-bumps, follows, and the personal records computed from your
        workouts.
      </p>
      <p>
        <strong>Technical data.</strong> A session token so you stay signed in (stored hashed on the server),
        and standard request information such as IP address, used only for security rate limiting. Chalk has
        no analytics, no advertising, no trackers, and no third-party SDKs.
      </p>

      <h2>How it&rsquo;s used</h2>
      <p>
        Solely to run the service: showing your published sessions in the feed and on your profile, computing
        records and streaks, and delivering in-app notifications. Published sessions are visible to other
        signed-in Chalk users; drafts are private to you.
      </p>

      <h2>Sharing</h2>
      <p>
        Your data is not sold, rented, or shared with third parties. It lives on the server that hosts this
        Chalk instance and is not used to track you across other apps or websites.
      </p>

      <h2>Retention &amp; deletion</h2>
      <p>
        Your data is kept while your account exists. You can delete your account at any time in
        <strong> Settings → Danger zone</strong> (in the app). Deletion is immediate and permanent: your
        account, workouts, records, photos, comments, follows, and notifications are removed.
      </p>

      <h2>Children</h2>
      <p>Chalk is not directed at children under 13, and we do not knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>If this policy changes, the date above is updated and the new version is posted at this URL.</p>
    </LegalShell>
  )
}

export function SupportPage() {
  return (
    <LegalShell title="Support">
      <h2>Getting started</h2>
      <p>
        Hit the <strong>+</strong> button to log a session: pick exercises from the library (or add your
        own), enter your sets, and publish. Published sessions appear in your followers&rsquo; feeds as
        session cards; drafts stay private until you post them.
      </p>

      <h2>Records &amp; units</h2>
      <p>
        PRs (max weight, estimated 1RM, rep records) are detected automatically when you publish and live in
        the <strong>Records</strong> tab. Switch between kg and lb any time in <strong>Settings</strong> —
        everything is stored in kg and converted for display, so nothing is lost.
      </p>

      <h2>Account &amp; data</h2>
      <p>
        To permanently delete your account and all of its data, go to <strong>Settings → Danger zone → Delete
        account</strong>. See the <Link to="/privacy">privacy policy</Link> for what Chalk stores.
      </p>

      <h2>Something broken?</h2>
      <p>
        Email us and include your username, what you did, and what you expected to happen — screenshots help.
      </p>
    </LegalShell>
  )
}
