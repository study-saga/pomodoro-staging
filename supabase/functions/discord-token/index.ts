import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";
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
    const accessToken = tokens.access_token

    // --- NEW: Mint Supabase JWT ---

    // 1. Fetch Discord User ID
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!userResponse.ok) {
      console.error('Failed to fetch Discord user:', await userResponse.text())
      // Fallback: Return just the Discord tokens (old behavior)
      return new Response(JSON.stringify(tokens), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const discordUser = await userResponse.json()
    const discordId = discordUser.id

    // 2. Mint Supabase JWT
    // We need the JWT Secret. In Supabase Edge Functions, it's usually available.
    // If not, we can't sign.
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET') || Deno.env.get('JWT_SECRET')

    if (jwtSecret) {
      // Create a custom JWT for this user
      // We use the Discord ID as the 'sub' (subject) or map it to a UUID if we have one.
      // Ideally we should query the database to get the real UUID, but we might not have DB access here easily without supabase-js.
      // For now, let's assume we can use a deterministic UUID based on Discord ID or just use the Discord ID if UUID format isn't strictly enforced by Auth (it is).

      // Wait, Auth requires UUID.
      // We can't just use Discord ID (snowflake).
      // We need to query the DB to get the `id` from `public.users` where `discord_id` = ...

      // Let's use the Service Role to query DB.
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

      if (supabaseUrl && supabaseServiceKey) {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        // Find user by discord_id
        const { data: existingUser, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('discord_id', discordId)
          .maybeSingle()

        let userId = existingUser?.id

        if (!userId) {
          console.log('[Discord Token] User not found, creating new user for Discord ID:', discordId)
          // Create new user
          const { data: newUser, error: createError } = await supabaseAdmin
            .from('users')
            .insert({
              discord_id: discordId,
              username: discordUser.username,
              avatar: discordUser.avatar,
              // Set defaults
              level: 1,
              xp: 0,
              prestige_level: 0,
              level_path: 'human',
              consecutive_login_days: 1,
              total_unique_days: 1,
              total_pomodoros: 0,
              total_study_minutes: 0,
              sound_enabled: true,
              volume: 80,
              music_volume: 50,
              level_system_enabled: true,
              last_login: new Date().toISOString(),
              last_login_date: new Date().toISOString().split('T')[0],
              role: 'user' // Default role
            })
            .select('id')
            .single()

          if (createError) {
            console.error('[Discord Token] Failed to create user:', createError)
          } else {
            userId = newUser.id
            console.log('[Discord Token] Created new user:', userId)
          }
        }

        if (userId) {
          // User exists (or was created), mint token for this UUID
          const payload = {
            aud: 'authenticated',
            role: 'authenticated',
            sub: userId,
            exp: getNumericDate(60 * 60 * 24), // 24 hours
            app_metadata: { provider: 'discord', discord_id: discordId },
            user_metadata: { discord_id: discordId }
          }

          const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(jwtSecret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign", "verify"],
          );

          const supabaseToken = await create({ alg: "HS256", typ: "JWT" }, payload, key);

          // Return both tokens
          return new Response(JSON.stringify({ ...tokens, supabase_token: supabaseToken }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // Fallback if we couldn't mint token
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
