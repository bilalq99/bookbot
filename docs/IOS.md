# Chalk on iOS (App Store)

The iOS app is a [Capacitor](https://capacitorjs.com) shell: the built React SPA
ships inside the native app (served from `capacitor://localhost`), and it talks
to a **hosted Chalk API** over HTTPS. The Xcode project lives in `ios/` and is
committed; only the generated web assets inside it are gitignored.

How the pieces differ from the web app:

- **Auth** — the shell authenticates with a **bearer token** (returned by
  login/register and stored on-device) instead of relying on cross-origin
  cookies, which WKWebView handles unreliably. The browser SPA keeps using the
  httpOnly cookie; both paths hit the same endpoints.
- **CORS/CSRF** — the server allows the app-shell origins
  (`capacitor://localhost`, `ionic://localhost` by default; override with the
  `CORS_ORIGINS` env var) and skips the CSRF origin check for bearer requests.
- **Media** — photo URLs are made absolute against the API origin.
- **UI** — safe-area insets (notch/home indicator), dark status bar content,
  and the required **account deletion** flow (Settings → Danger zone) are in.

## 1. Host the API

Deploy this repo to any Node 22 host with a **persistent disk** (SQLite file +
uploads live on disk): a VPS, Fly.io, Railway, Render, etc. Ready-made configs
are included — **`fly.toml`** (see its header for the three-command launch) and
**`render.yaml`** (Render → New → Blueprint).

```bash
npm ci && npm run build
PORT=3000 DB_PATH=/data/chalk.db UPLOADS_DIR=/data/uploads node dist/server/index.js
```

Or use the included **Dockerfile** (multi-stage, non-root; data on a `/data`
volume): `docker build -t chalk . && docker run -p 3000:3000 -v chalk-data:/data chalk`.

Put it behind **HTTPS** (a reverse proxy such as Caddy/nginx, or the platform's
TLS) — iOS App Transport Security requires it. When deployed that way, set
`TRUST_PROXY=1` (correct client IPs for the auth rate limiter) and
`COOKIE_SECURE=1` (Secure session cookies for web visitors). `GET /api/health`
is an unauthenticated liveness probe for load balancers. Optionally run
`npm run seed` once if you want the demo world in production (you probably don't).

## 2. Build the app against your API

**No Mac?** The GitHub Actions workflow `.github/workflows/ios-testflight.yml`
builds, signs, and uploads to TestFlight on a hosted macOS runner — you only
add four Apple secrets and run it from the Actions tab. Setup steps are in
`docs/APPSTORE.md` ("Upload path"). The rest of this section is the local-Mac
alternative.

On a Mac with Xcode 15+ (Capacitor 8 uses Swift Package Manager — no CocoaPods):

```bash
npm ci
VITE_API_BASE=https://api.your-domain.com npm run ios:sync   # build + cap sync ios
npm run ios:open                                             # opens ios/App in Xcode
```

In Xcode: select the **App** target → Signing & Capabilities → choose your
Team, and change the bundle identifier from `com.chalk.lifting` to one you own
(also update `appId` in `capacitor.config.ts` to match). Then run on a
simulator or device.

### Developing against a local server

`VITE_API_BASE=http://<your-mac-ip>:3000` works in the **simulator** only if
you add a temporary ATS exception (Info.plist → `NSAppTransportSecurity` →
`NSAllowsArbitraryLoads` = YES). **Remove it before submitting** — App Review
rejects blanket ATS exceptions. An HTTPS tunnel (e.g. `cloudflared`, `ngrok`)
avoids the exception entirely. Remember to add the tunnel/LAN origin's scheme
if you change `CORS_ORIGINS`; the defaults already cover the app shell.

## 3. App Store submission checklist

Already handled in this repo:

- [x] App icon (1024×1024, `ios/App/App/Assets.xcassets/AppIcon.appiconset`)
- [x] Launch screen (branded splash in `Splash.imageset`)
- [x] Account deletion in-app (guideline 5.1.1(v)) — Settings → Danger zone
- [x] Camera / photo-library usage descriptions in Info.plist
- [x] No blanket ATS exceptions, no private APIs, no third-party trackers
- [x] **Privacy policy & support pages** — the app serves them publicly at
      `/privacy` and `/support` (linked from login and Settings), so once the
      API is hosted you have `https://your-domain/privacy` and
      `https://your-domain/support` to paste into App Store Connect. Before
      submitting: read the policy text (`src/client/pages/LegalPage.tsx`) to
      confirm it matches how you actually run the server, and replace the
      `CONTACT_EMAIL` placeholder at the top with a monitored address.

- [x] **Screenshots** — pre-generated App Store sets in
      `appstore/screenshots/` (6.9" and 6.7", from the seeded demo world);
      regenerate with `scripts/appstore-screenshots.cjs`
- [x] **Listing copy & questionnaire answers** — name/subtitle/description/
      keywords, App Privacy answers, and App Review notes are all drafted in
      `docs/APPSTORE.md`, ready to paste
- [x] **Export compliance** — `ITSAppUsesNonExemptEncryption=false` is set in
      Info.plist (standard HTTPS only), so uploads skip the encryption prompt
- [x] **TestFlight upload without a Mac** —
      `.github/workflows/ios-testflight.yml` (setup in `docs/APPSTORE.md`)

You still need to (in order):

- [ ] Apple Developer Program membership ($99/yr)
- [ ] Host the API (step 1 above — `fly.toml` / `render.yaml` make it quick)
- [ ] Create the app record in App Store Connect, add the four Apple secrets
      to GitHub, and run the **iOS → TestFlight** workflow (or archive locally
      in Xcode if you have a Mac)
- [ ] A **demo account** for App Review on your production server (run
      `npm run seed` there once, or register one and log a few sessions), then
      paste the listing from `docs/APPSTORE.md`, attach the screenshots, test
      via TestFlight, and submit

## Notes & limitations

- The session token is kept in the WebView's localStorage. iOS does not purge
  it for installed apps in practice, but if you want belt-and-braces
  persistence later, mirror it through `@capacitor/preferences`.
- Notifications are in-app only (the bell). Real push notifications would need
  `@capacitor/push-notifications` plus APNs setup — not included.
- The SPA uses history routing; the shell always boots at `/`, so no extra
  server config is needed inside the app.
