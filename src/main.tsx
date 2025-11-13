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
// This allows requests to Supabase to bypass CSP restrictions in Discord iframe
// R2 media files use direct URLs and load from R2 (saves Vercel bandwidth!)
if (isDiscordActivity()) {
  console.log('[Main] Discord Activity detected - applying URL mappings')
  patchUrlMappings([
    {
      prefix: '/supabase',
      target: 'btjhclvebbtjxmdnprwz.supabase.co'
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
