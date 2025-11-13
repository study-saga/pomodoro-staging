import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { patchUrlMappings } from '@discord/embedded-app-sdk'
import './index.css'
import App from './App.tsx'

// Check if running inside Discord Activity
const isDiscordActivity = () => {
  const params = new URLSearchParams(window.location.search)
  return params.has('frame_id') || params.has('instance_id')
}

// Configure Discord proxy URL mappings ONLY for Discord Activities
// This allows requests to Supabase and R2 to bypass CSP restrictions in Discord iframe
// Do NOT apply on web - Vercel rewrites handle R2 paths on web
if (isDiscordActivity()) {
  console.log('[Main] Discord Activity detected - applying URL mappings')
  patchUrlMappings([
    {
      prefix: '/supabase',
      target: 'btjhclvebbtjxmdnprwz.supabase.co'
    },
    {
      prefix: '/r2-audio',
      target: 'pub-7e068d8c526a459ea67ff46fe3762059.r2.dev/music'
    },
    {
      prefix: '/r2-effects',
      target: 'pub-7e068d8c526a459ea67ff46fe3762059.r2.dev/effects'
    },
    {
      prefix: '/r2-backgrounds',
      target: 'pub-7e068d8c526a459ea67ff46fe3762059.r2.dev/backgrounds'
    }
  ])
} else {
  console.log('[Main] Web environment detected - skipping URL mappings')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
