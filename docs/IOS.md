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
uploads live on disk): a VPS, Fly.io, Railway, Render, etc.

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

You still need to:

- [ ] Apple Developer Program membership ($99/yr)
- [ ] A **privacy policy URL** (App Store Connect requires one; the app stores
      account data, workouts, and photos)
- [ ] Fill in the **App Privacy** questionnaire (collected: account info
      [username], user content [workouts, photos, comments]; not used for
      tracking)
- [ ] Screenshots for 6.7" and 6.5" iPhones (run in the simulator and use
      Xcode's screenshot tool; the seeded demo world makes good material)
- [ ] A **demo account** for App Review (register one on your production
      server and put the credentials in the review notes)
- [ ] Archive → Distribute via Xcode or Transporter, test through TestFlight,
      then submit

## Notes & limitations

- The session token is kept in the WebView's localStorage. iOS does not purge
  it for installed apps in practice, but if you want belt-and-braces
  persistence later, mirror it through `@capacitor/preferences`.
- Notifications are in-app only (the bell). Real push notifications would need
  `@capacitor/push-notifications` plus APNs setup — not included.
- The SPA uses history routing; the shell always boots at `/`, so no extra
  server config is needed inside the app.
