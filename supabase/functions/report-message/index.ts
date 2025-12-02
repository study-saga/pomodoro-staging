import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Get current user
        const {
            data: { user },
        } = await supabaseClient.auth.getUser()

        if (!user) {
            throw new Error('Unauthorized')
        }

        const { messageId, reason, reportedUserId, reportedUsername, reportedContent, origin } = await req.json()

        if (!messageId || !reason) {
            throw new Error('Missing required fields')
        }

        // 1. Insert report into database
        // We need to fetch the reporter's internal ID (public.users.id) from their auth ID
        const { data: reporterData, error: reporterError } = await supabaseClient
            .from('users')
            .select('id, username')
            .eq('auth_user_id', user.id)
            .single()

        if (reporterError || !reporterData) {
            throw new Error('Reporter not found in public.users')
        }

        const { error: insertError } = await supabaseClient
            .from('chat_reports')
            .insert({
                message_id: messageId,
                reporter_id: reporterData.id,
                reason: reason,
                status: 'pending'
            })

        if (insertError) {
            console.error('Error inserting report:', insertError)
            throw insertError
        }

        // 2. Send to Discord Webhook
        const webhookUrl = Deno.env.get('DISCORD_REPORT_WEBHOOK_URL')

        if (webhookUrl) {
            const fields = [
                {
                    name: "Reported User",
                    value: `${reportedUsername} (ID: ${reportedUserId})`,
                    inline: true
                },
                {
                    name: "Reporter",
                    value: `${reporterData.username} (ID: ${reporterData.id})`,
                    inline: true
                },
                {
                    name: "Reason",
                    value: reason,
                    inline: false
                },
                {
                    name: "Message Content",
                    value: reportedContent || "*[No content or deleted]*",
                    inline: false
                },
                {
                    name: "Message ID",
                    value: messageId,
                    inline: false
                }
            ];

            // Add Quick Ban links if origin is present
            // We use the 'quick-ban' Edge Function for one-click bans from Discord
            const quickBanUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/quick-ban`;
            const quickBanSecret = Deno.env.get('QUICK_BAN_SECRET');

            if (quickBanUrl && quickBanSecret) {
                // Helper to create HMAC-SHA256 signature
                const createSignature = async (data: string, secret: string) => {
                    const encoder = new TextEncoder();
                    const key = await crypto.subtle.importKey(
                        "raw",
                        encoder.encode(secret),
                        { name: "HMAC", hash: "SHA-256" },
                        false,
                        ["sign"]
                    );
                    const signature = await crypto.subtle.sign(
                        "HMAC",
                        key,
                        encoder.encode(data)
                    );
                    return Array.from(new Uint8Array(signature))
                        .map((b) => b.toString(16).padStart(2, "0"))
                        .join("");
                };

                const banLink = async (duration: string, label: string) => {
                    // Sign the data: userId:duration
                    const signature = await createSignature(`${reportedUserId}:${duration}`, quickBanSecret);
                    
                    const params = new URLSearchParams({
                        userId: reportedUserId,
                        duration: duration,
                        signature: signature
                    });
                    return `[${label}](${quickBanUrl}?${params.toString()})`;
                };

                // We need to await the links since crypto is async
                const link24h = await banLink('24h', 'Ban 24h');
                const link1w = await banLink('168h', 'Ban 1 Week');
                const linkPerm = await banLink('permanent', 'Permaban');

                fields.push({
                    name: "🛡️ Quick Actions",
                    value: `${link24h} • ${link1w} • ${linkPerm}`,
                    inline: false
                });
            } else if (origin) {
                // Fallback to frontend links if quick-ban is not configured
                const banLink = (duration: string, label: string) => {
                    const params = new URLSearchParams({
                        action: 'ban',
                        userId: reportedUserId,
                        username: reportedUsername,
                        duration: duration
                    });
                    return `[${label}](${origin}?${params.toString()})`;
                };

                fields.push({
                    name: "🛡️ Quick Actions (Frontend)",
                    value: `${banLink('24h', 'Ban 24h')} • ${banLink('168h', 'Ban 1 Week')} • ${banLink('permanent', 'Permaban')}`,
                    inline: false
                });
            }

            const embed = {
                title: "🚨 New Chat Report",
                color: 16711680, // Red
                fields: fields,
                timestamp: new Date().toISOString()
            }

            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] }),
            })
        } else {
            console.warn('DISCORD_REPORT_WEBHOOK_URL is not set')
        }

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
