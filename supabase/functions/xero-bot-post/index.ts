import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const MOTIVATIONAL_MESSAGES = [
  // Motivational (20 messages)
  "You got this! Every Pomodoro counts toward your goals 💪",
  "Stay focused! Great things take time and consistency ⏰",
  "Remember: progress > perfection. Keep going! 🚀",
  "Your future self will thank you for the work you're doing now ✨",
  "Break tasks into small wins. Celebrate each one! 🎯",
  "Discipline today = freedom tomorrow. Keep grinding! 🔥",
  "The best time to start was yesterday. The next best time is now ⚡",
  "You're building something amazing, one session at a time 🏗️",
  "Don't stop when you're tired. Stop when you're done 💯",
  "Small steps daily lead to big leaps yearly 📈",
  "Focus is your superpower. Use it wisely! 🧠",
  "Consistency beats intensity. Show up every day! 📅",
  "Your only limit is you. Push past it today 🌟",
  "Champions are made in the grind. Keep pushing! 🏆",
  "The work you do in silence will speak in results 🤫",
  "Effort compounds. Your results are on the way 📊",
  "Uncomfortable = growth. Embrace the challenge! 🌱",
  "Winners focus on winning. Losers focus on winners. Be the winner 🥇",
  "You're stronger than you think. Prove it today 💪",
  "Excuses don't build empires. Action does ⚔️",

  // Supportive/Encouraging (15 messages)
  "Studying? Smart move! ",
  "Struggling? That's okay. Every expert was once a beginner 🌱",
  "Feeling stuck? Try breaking it down into smaller tasks 🧩",
  "Remember to hydrate and stretch! Your body supports your mind 💧",
  "Burnout is real. Take care of yourself first ❤️",
  "You're not alone in this journey. Keep going! 🤝",
  "Celebrate small wins. Progress is progress! 🎉",
  "Rest is productive too. Don't feel guilty 😴", con
   "It's okay to ask for help. Reach out when you need it 🆘",
  "Your mental health matters more than any deadline 🧘",
  "You're doing better than you think. Trust the process 🌀",
  "Every Pomodoro is a victory. Be proud! 🏅",

  // Greetings/Check-ins (10 messages)
  "Hey everyone! How's the focus today? 👋",
  "Hope you're all having a productive session! 📚",
  "Checking in! Don't forget to take breaks 😊",
  "Good vibes to everyone grinding right now ✌️",
  "Pomodoro warriors, assemble! Let's get it 🛡️",
  "Who's on a streak today? Drop a heart! ❤️",
  "Friendly reminder: Cheer of every win",
  "Just popping in to say I am very thirsty 🥵",
  "Anyone hitting their goals today? 🎯",
  "Sending positive energy to the chat 🌈",
  "I am studying Anthropology, what about you?",

  // Random Fun (10 messages)
  "Fun fact: The Pomodoro Technique was invented in the late 1980s 🍅",
  "Did you know? 25 minutes is the optimal focus duration for most people ⏲",
  "Xero's wisdom: Coffee + Focus = Magic ☕✨",
  "Pro tip: Turn off notifications for ultimate focus mode 📵",
  "Study hack: Teach what you learn to solidify understanding 🎓",
  "Curiosity: What's everyone working on today? 🤔",
  "Reminder: Comparison is the thief of joy. You're on your own path ",
  "Brain fact: Breaks help consolidate learning. Science says so! 🧪",
  "Xero's motto: Work hard, rest harder ",
  "The only bad Pomodoro is the one you didn't start 🍅"
];

serve(async (req) => {
  try {
    // Initialize Supabase with SERVICE ROLE key (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // SERVICE ROLE KEY
    );

    // 1. Fetch bot config from system_settings
    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'xero_bot_config')
      .single();

    if (configError) {
      console.error('[Xero Bot] Config fetch error:', configError);
      throw new Error('Failed to fetch bot config');
    }

    const config = configData.value as {
      enabled: boolean;
      bot_username: string;
    };

    // 2. Check if bot is enabled
    if (!config.enabled) {
      console.log('[Xero Bot] Bot is disabled via config');
      return new Response(
        JSON.stringify({ message: 'Bot disabled' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Fetch bot user from users table
    const { data: botUser, error: botError } = await supabaseAdmin
      .from('users')
      .select('id, username, avatar, discord_id, role')
      .eq('username', config.bot_username)
      .single();

    if (botError || !botUser) {
      console.error('[Xero Bot] Bot user not found:', botError);
      throw new Error('Bot user not found in database');
    }

    // 4. Select random message
    const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length);
    const message = MOTIVATIONAL_MESSAGES[randomIndex];

    // 5. Insert message into chat_messages (SERVICE ROLE bypasses RLS)
    const { error: insertError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        id: crypto.randomUUID(),
        user_id: botUser.id,
        content: message,
        user_role: botUser.role,
        username: botUser.username,
        is_deleted: false
      });

    if (insertError) {
      console.error('[Xero Bot] Insert error:', insertError);
      throw insertError;
    }

    console.log(`[Xero Bot] Posted: "${message.substring(0, 50)}..."`);

    return new Response(
      JSON.stringify({
        success: true,
        message: message,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Xero Bot] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
