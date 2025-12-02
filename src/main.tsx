import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react"
import { patchUrlMappings } from '@discord/embedded-app-sdk'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'

// Check if running inside Discord Activity
const isDiscordActivity = () => {
  const params = new URLSearchParams(window.location.search)
  return params.has('frame_id') || params.has('instance_id')
}

// Initialize Sentry with Discord CSP bypass via tunnel
Sentry.init({
  dsn: "https://07207291057d3269e8c544fa37a6261f@o4510434264875008.ingest.de.sentry.io/4510434268086352",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when an error occurs.
  // Tunnel for Discord CSP bypass - route through Discord proxy
  ...(isDiscordActivity() && {
    tunnel: '/sentry/api/4510434268086352/envelope/',
  }),
});

// Configure Discord proxy URL mappings ONLY for Discord Activities
// This allows requests to bypass CSP restrictions in Discord iframe
// Maps Supabase AND R2 resources through Discord's proxy
if (isDiscordActivity()) {
  // Extract Supabase hostname from environment (dynamic for dev/prod)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  
  // Validate that VITE_SUPABASE_URL is defined and non-empty
  if (!supabaseUrl || supabaseUrl.trim() === '') {
    const errorMsg = '[Main] FATAL: VITE_SUPABASE_URL is not defined or empty in Discord Activity mode'
    console.error(errorMsg)
    throw new Error(errorMsg)
  }

  // Parse URL with try-catch to handle malformed URLs
  let supabaseHost: string
  try {
    supabaseHost = new URL(supabaseUrl).hostname
  } catch (error) {
    const errorMsg = `[Main] FATAL: Invalid VITE_SUPABASE_URL format in Discord Activity mode. Value: "${supabaseUrl}"`
    console.error(errorMsg, error)
    throw new Error(errorMsg)
  }

  console.log('[Main] Discord Activity detected - applying URL mappings')
  console.log('[Main] Supabase host:', supabaseHost)

  patchUrlMappings([
    {
      prefix: '/supabase',
      target: supabaseHost
    },
    {
      prefix: '/r2-audio',
      target: 'cdn.study-saga.com/music'
    },
    {
      prefix: '/r2-effects',
      target: 'cdn.study-saga.com/effects'
    },
    {
      prefix: '/r2-backgrounds',
      target: 'cdn.study-saga.com/backgrounds'
    },
    {
      prefix: '/sentry',
      target: 'o4510434264875008.ingest.de.sentry.io'
    }
  ])
} else {
  console.log('[Main] Web environment detected - skipping URL mappings')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<div className="flex items-center justify-center min-h-screen text-white">An error has occurred</div>} showDialog>
      <App />
    </Sentry.ErrorBoundary>
    <Analytics />
  </StrictMode>,
)
