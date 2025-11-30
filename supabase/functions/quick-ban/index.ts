import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const userId = url.searchParams.get('userId')
        const duration = url.searchParams.get('duration')
        const signature = url.searchParams.get('signature')

        if (!userId || !duration || !signature) {
            return new Response('Missing required parameters', { status: 400 })
        }

        // Verify signature
        const secret = Deno.env.get('QUICK_BAN_SECRET')
        if (!secret) {
            return new Response('Server Configuration Error', { status: 500 })
        }

        // Re-create signature to verify
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );
        const expectedSignatureBuffer = await crypto.subtle.sign(
            "HMAC",
            key,
            encoder.encode(`${userId}:${duration}`)
        );
        const expectedSignature = Array.from(new Uint8Array(expectedSignatureBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

        // Constant-time comparison (to prevent timing attacks, though low risk here)
        if (signature !== expectedSignature) {
            return new Response('Unauthorized: Invalid signature', { status: 401 })
        }

        // Initialize Supabase with Service Role Key to bypass RLS
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Calculate expiration
        let expiresAt = null
        if (duration !== 'permanent') {
            const minutes = duration === '24h' ? 24 * 60 : (duration === '168h' ? 7 * 24 * 60 : 0)
            if (minutes > 0) {
                const date = new Date()
                date.setMinutes(date.getMinutes() + minutes)
                expiresAt = date.toISOString()
            }
        }

        // Insert ban
        // We need a 'banned_by' ID. Since this is automated and we don't know who clicked the link,
        // we prefer to attribute it to a 'System' user if one exists.

        // 1. Try to find a user named 'System'
        let { data: bannerUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('username', 'System')
            .single()

        // 2. If not found, fall back to the first admin found
        if (!bannerUser) {
            const { data: adminUser } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('role', 'admin')
                .limit(1)
                .single()
            bannerUser = adminUser
        }

        if (!bannerUser) {
            return new Response('System Error: No admin or System user found to attribute ban', { status: 500 })
        }

        const { error } = await supabaseAdmin
            .from('chat_bans')
            .insert({
                user_id: userId,
                banned_by: bannerUser.id,
                reason: `Quick Ban via Report (${duration})`,
                expires_at: expiresAt
            })

        if (error) {
            console.error('Ban error:', error)
            return new Response(`Failed to ban user: ${error.message}`, { status: 500 })
        }

        // Explicitly soft-delete user's messages
        const { error: deleteError, data: deletedRows } = await supabaseAdmin
            .from('chat_messages')
            .update({ is_deleted: true })
            .eq('user_id', userId)
            .select('id')

        const deletedCount = deletedRows?.length || 0;

        // Verify remaining non-deleted messages
        const { count: remainingCount } = await supabaseAdmin
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_deleted', false)

        if (deleteError) {
            console.error('Failed to auto-delete messages:', deleteError)
        }

        console.log(`[Quick Ban] User ${userId}: Deleted ${deletedCount} messages, ${remainingCount} remaining`)

        // Return a simple HTML success page
        const html = `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>User Banned</title>
            <style>
                body { background: #111; color: #fff; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: #222; padding: 2rem; border-radius: 1rem; text-align: center; border: 1px solid #333; box-shadow: 0 4px 20px rgba(0,0,0,0.5); max-width: 500px; }
                h1 { color: #ef4444; margin: 0 0 1rem 0; }
                p { color: #888; margin: 0.5rem 0; }
                .success { color: #22c55e; font-weight: bold; font-size: 1.2rem; margin: 1rem 0; }
                .debug { margin-top: 1.5rem; padding: 1rem; background: #000; border-radius: 0.5rem; font-family: monospace; text-align: left; font-size: 0.85rem; color: #aaa; line-height: 1.6; }
                .debug strong { color: #fff; display: block; margin-bottom: 0.5rem; }
                .debug .error { color: #ef4444; }
                .debug .success { color: #22c55e; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🛡️ Ban Executed</h1>
                <p><strong>User ID:</strong> ${userId}</p>
                <p><strong>Duration:</strong> ${duration}</p>
                <div class="success">✓ User has been banned successfully</div>
                
                <div class="debug">
                    <strong>Debug Information:</strong>
                    ${deleteError ? `<div class="error">❌ Delete Error: ${deleteError.message}</div>` : '<div class="success">✓ No errors</div>'}
                    <div>📊 Messages Deleted: ${deletedCount}</div>
                    <div>📊 Messages Remaining (non-deleted): ${remainingCount || 0}</div>
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #333; font-size: 0.75rem; color: #666;">
                        ${deletedCount > 0 && remainingCount === 0 ?
                '<div class="success">✓ All messages successfully removed</div>' :
                deletedCount === 0 ?
                    '<div style="color: #ff9800;">⚠ No messages found to delete</div>' :
                    '<div class="error">⚠ Some messages may still exist</div>'
            }
                    </div>
                </div>

                <p style="font-size: 0.8rem; margin-top: 2rem; color: #666;">You can close this window.</p>
            </div>
        </body>
        </html>`

        return new Response(html, {
            headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
