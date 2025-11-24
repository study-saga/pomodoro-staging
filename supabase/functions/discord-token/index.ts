import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let code: string
    try {
      const body = await req.json()
      code = body.code
    } catch (jsonError) {
      console.error('[Discord Token] Invalid JSON in request body:', jsonError)
      return new Response(
        JSON.stringify({ error: 'Invalid request: Expected JSON body with code field' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization code' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Determine environment based on origin or use staging credentials if available
    const origin = req.headers.get('origin') || ''
    // Match staging domains more precisely to avoid false positives
    const isStagingDomain = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?/.test(origin) ||
                           origin.endsWith('.vercel.app')
    const isStaging = isStagingDomain

    // Use staging credentials if available and request is from staging, otherwise use production
    const clientId = isStaging && Deno.env.get('DISCORD_CLIENT_ID_STAGING')
      ? Deno.env.get('DISCORD_CLIENT_ID_STAGING')!
      : Deno.env.get('DISCORD_CLIENT_ID')!

    const clientSecret = isStaging && Deno.env.get('DISCORD_CLIENT_SECRET_STAGING')
      ? Deno.env.get('DISCORD_CLIENT_SECRET_STAGING')!
      : Deno.env.get('DISCORD_CLIENT_SECRET')!

    // Validate environment variables
    if (!clientId || !clientSecret) {
      console.error('[Discord Token] Missing Discord credentials:', { clientId: !!clientId, clientSecret: !!clientSecret, isStaging })
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Discord credentials' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('[Discord Token] Using', isStaging ? 'STAGING' : 'PRODUCTION', 'credentials for origin:', origin)

    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Discord token exchange failed:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to exchange authorization code' }),
        {
          status: tokenResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const tokens = await tokenResponse.json()

    return new Response(JSON.stringify(tokens), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in discord-token function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
