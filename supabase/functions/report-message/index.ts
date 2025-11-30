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

        const { messageId, reason, reportedUserId, reportedUsername, reportedContent } = await req.json()

        if (!messageId || !reason) {
            throw new Error('Missing required fields')
        }

        // 1. Insert report into database (using service role to bypass RLS if needed, or just user auth)
        // We'll use a service role client to ensure we can fetch user details if needed, 
        // but for insertion, the user's client is fine if RLS allows it.
        // However, to be safe and robust, let's use the user's client for the insert to respect RLS,
        // and then use the input data for the webhook.

        // Actually, we need to fetch the reporter's internal ID (public.users.id) from their auth ID
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
            const embed = {
                title: "🚨 New Chat Report",
                color: 16711680, // Red
                fields: [
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
                ],
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
