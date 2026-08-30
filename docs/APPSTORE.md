# App Store Connect — ready-to-paste listing

Everything below is written to paste straight into App Store Connect when you
create the app. Screenshots are pre-generated in `appstore/screenshots/`
(6.9" 1320×2868 and 6.7" 1290×2796 — upload either set; both are accepted for
the required iPhone slot). Regenerate any time with
`scripts/appstore-screenshots.cjs` against a seeded server.

## App information

| Field | Value |
| --- | --- |
| **Name** (30 chars) | `Chalk: Lifting Tracker` — "Chalk" alone is likely taken; App Store Connect checks on save, alternatives: `Chalk — Log Heavy`, `Chalk Strength Log` |
| **Subtitle** (30 chars) | `The social lifting tracker` |
| **Primary category** | Health & Fitness |
| **Secondary category** | Social Networking |
| **Age rating** | Answer "None" to all sensitive-content questions except **Unrestricted Web Access: No** and **User-Generated Content: Yes** (users post workouts, photos, comments — the app has account blocking? No → answer honestly: it has reporting/blocking **only** via account deletion; Apple accepts UGC apps with moderation via the contact email, but flagging/blocking may be requested — see note below) → expect **12+** |
| **Privacy policy URL** | `https://<your-domain>/privacy` (served by the app) |
| **Support URL** | `https://<your-domain>/support` (served by the app) |

> **UGC note:** Apple's guideline 1.2 asks UGC apps for a way to report/block
> abusive content. Chalk's current answer is the monitored support address on
> `/support`. If review pushes back, an in-app "report" button on
> sessions/comments is the fix — ask Claude Code to add one.

## Promotional text (170 chars)

> Log heavy, lift together. Track every set, ring the PR bell, and share
> session cards with the lifters you train with. Powerlifting to calisthenics.

## Description

> Chalk is a workout log built for strength sports — powerlifting, Olympic
> weightlifting, bodybuilding, strongman, and calisthenics — with a social feed
> that makes training with friends feel like training together.
>
> LOG EVERY SET
> Pick from a 77-exercise library or add your own. Weight × reps, bodyweight
> movements, timed holds, loaded carries — each tracked the way that lift
> actually works, with warm-up sets, your previous numbers ghosted in, and a
> built-in rest timer. Start from scratch or repeat your last session.
>
> EVERY SESSION BECOMES A CARD
> Finish a workout and Chalk turns it into a session card: your headline lift
> in big numerals, the loaded barbell drawn plate by plate, volume, sets, and
> duration. Add photos if you want — the card looks great without them.
>
> RING THE PR BELL
> Chalk detects records automatically: max weight, estimated 1RM, rep records,
> longest holds, heaviest carries. PRs get celebrated when you post, badged on
> your cards, and pushed to your followers' notifications.
>
> LIFT TOGETHER
> Follow your training partners, fist-bump their sessions, talk in the
> comments. The feed shows the people you follow — or every lifter on Chalk
> when you want ideas.
>
> KNOW YOUR NUMBERS
> A records room with your best squat, bench, and deadlift (real and
> estimated), your powerlifting total, weekly streaks, and 12 weeks of volume
> at a glance. Kilograms or pounds — switch any time.
>
> No ads. No trackers. Your training data stays yours — export-free account
> deletion is built in.

## Keywords (100 chars)

```
lifting,workout log,powerlifting,bodybuilding,strongman,calisthenics,PR,1RM,gym,strength,barbell
```

## App Privacy questionnaire

Data collected (all **linked to identity** via the account, **not** used for
tracking, no third parties):

| App Store category | What Chalk collects |
| --- | --- |
| Contact Info → **Name** | Optional display name |
| **User Content** → Photos or Videos | Session photos |
| **User Content** → Other User Content | Workouts, comments, bio |
| **Identifiers** → User ID | Account username / ID |

Everything else (location, health†, financial, browsing, purchases, diagnostics,
advertising data): **not collected**.

> † Workout logs count as "Fitness" under Health & Fitness → answer **Fitness:
> collected, linked to identity, not used for tracking** as well.

## Version release notes (1.0)

> First public release: set-by-set logging for strength sports, automatic PR
> detection, session cards, follows, fist-bumps, comments, and notifications.

## App Review notes (paste into the review information box)

> Chalk is a client for our own hosted API (same repo). A demo account is
> pre-loaded with a realistic training history:
>
> Username: demo
> Password: demo1234
>
> The feed, profiles, records, and notifications are all populated for this
> account. To test logging: tap the + tab, "Start empty", search any exercise,
> enter a couple of sets, then Finish → Post session. Account deletion is in
> Settings → Danger zone. No purchases, no ads, no third-party SDKs.

Before submitting, create that demo account on **your production server**:
either run `npm run seed` there once (creates `demo`/`demo1234` with history),
or register a fresh account through the app and log a few sessions.

## Upload path (no Mac needed)

The GitHub Actions workflow `.github/workflows/ios-testflight.yml` builds,
signs, and uploads to TestFlight on a hosted macOS runner. One-time setup:

1. Join the Apple Developer Program, then in App Store Connect create the app
   record (My Apps → **+** → New App; pick the bundle ID you'll build with).
2. App Store Connect → Users and Access → **Integrations** → App Store Connect
   API → generate a **Team key** with the **App Manager** role. Note the Key
   ID and Issuer ID and download the `.p8` once.
3. In the GitHub repo → Settings → Secrets and variables → Actions, add
   secrets: `APPLE_TEAM_ID` (from developer.apple.com membership page),
   `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_API_KEY` (the full text of the `.p8`).
4. Run the **iOS → TestFlight** workflow (Actions tab) with your API origin,
   e.g. `https://chalk-api.fly.dev`, and your bundle ID.

The build appears in App Store Connect → TestFlight in ~10 minutes; test it on
your phone via the TestFlight app, then add the metadata above, attach the
screenshots, and **Submit for Review**.
