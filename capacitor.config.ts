import type { CapacitorConfig } from '@capacitor/cli'

// The iOS shell serves the built SPA from capacitor://localhost and talks to a
// hosted Chalk API. Bake the API origin in at build time:
//   VITE_API_BASE=https://api.your-domain.com npm run build && npx cap sync ios
// See docs/IOS.md.
const config: CapacitorConfig = {
  appId: 'com.chalk.lifting',
  appName: 'Chalk',
  webDir: 'dist/client',
  backgroundColor: '#0B0C0E',
  ios: {
    contentInset: 'never',
  },
}

export default config
