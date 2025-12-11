import { supabase } from './supabase';
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';

/**
 * Get Discord avatar URL for a user
 */
export function getAvatarUrl(user: { avatar: string | null; discord_id?: string }): string | null {
  if (user.avatar) {
    // If avatar is already a full URL, return it
    if (user.avatar.startsWith('http')) {
      return user.avatar;
    }
    // If it's a Discord avatar hash, construct the URL
    if (user.discord_id) {
      return `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png`;
    }
  }
  return null;
}

/**
 * Format message timestamp to human-readable format
 * Examples: "today at 3:04 am", "yesterday at 11:30 pm", "Jan 15 at 2:45 pm"
 */
export function formatMessageTime(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // Format time as "3:04 am"
  const timeString = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).toLowerCase();

  // Today
  if (messageDate.getTime() === today.getTime()) {
    return `today at ${timeString}`;
  }

  // Yesterday
  if (messageDate.getTime() === yesterday.getTime()) {
    return `yesterday at ${timeString}`;
  }

  // This year
  if (date.getFullYear() === now.getFullYear()) {
    const monthDay = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    return `${monthDay} at ${timeString}`;
  }

  // Previous years
  const fullDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  return `${fullDate} at ${timeString}`;
}

/**
 * Format relative time for conversation list
 * Examples: "2m ago", "1h ago", "2d ago"
 */
export function formatRelativeTime(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  // For older messages, show date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Create deterministic conversation ID from two user IDs
 * Always returns UUIDs in sorted order: dm:{smaller_uuid}:{larger_uuid}
 */
export function getConversationId(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  return `dm:${sorted[0]}:${sorted[1]}`;
}

/**
 * Truncate message text for previews
 */
export function truncateMessage(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Validate message content
 */

// Initialize Obscenity Matcher
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

// Critical words to check for spaced variations (e.g. "s e x")
// We keep this custom check because standard filters often miss "s e x"
const CRITICAL_SPACED_WORDS = ['sex', 'ass', 'shit', 'fuck', 'bitch', 'nigger', 'cunt', 'hell', 'whore', 'slut'];

/**
 * Check for spaced profanity (e.g. "s e x") using strict word boundaries
 * This avoids false positives like "class example" matching "sex"
 */
function checkSpacedProfanity(text: string): boolean {
  const lower = text.toLowerCase();

  for (const word of CRITICAL_SPACED_WORDS) {
    if (word.length < 2) continue;

    // Create pattern: \bc\b[\s\W]+\bh\b[\s\W]+\ba\b...
    // Matches isolated characters separated by spaces/symbols
    const chars = word.split('');
    const patternParts = chars.map(c => `\\b${c}\\b`);
    const pattern = patternParts.join('[\\s\\W]+');
    const regex = new RegExp(pattern, 'i');

    if (regex.test(lower)) {
      return true;
    }
  }
  return false;
}

/**
 * Validate message content
 */
export function validateMessage(content: string): { valid: boolean; error?: string } {
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (trimmed.length > 500) {
    return { valid: false, error: 'Message too long (max 500 characters)' };
  }

  // Check for links (Spam prevention)
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9]+\.(com|org|net|io|co|us|uk|ca|de|jp|fr|au)\b)/i;
  if (urlPattern.test(trimmed)) {
    return { valid: false, error: 'Links are not allowed in chat' };
  }

  // 1. Check for profanity using 'obscenity' package (Handles leetspeak like "p0rn", "bo0bs")
  if (matcher.hasMatch(trimmed)) {
    return { valid: false, error: 'Please keep the chat clean' };
  }

  // 2. Check for spaced profanity (e.g. "s e x")
  if (checkSpacedProfanity(trimmed)) {
    return { valid: false, error: 'Please keep the chat clean' };
  }

  // Check for excessive newlines (spam prevention)
  const newlines = (content.match(/\n/g) || []).length;
  if (newlines > 10) {
    return { valid: false, error: 'Too many lines (max 10)' };
  }

  if (/\n{4,}/.test(content)) {
    return { valid: false, error: 'Too many consecutive empty lines' };
  }

  // Check for repeated characters (e.g. "aaaaaaaa")
  if (/(.)\1{15,}/.test(content)) {
    return { valid: false, error: 'Too many repeated characters' };
  }

  // Check for repeated words (e.g. "test test test")
  const words = content.split(/\s+/);
  for (let i = 0; i < words.length - 4; i++) {
    const slice = words.slice(i, i + 5);
    if (slice.every(w => w.toLowerCase() === slice[0].toLowerCase())) {
      return { valid: false, error: 'Too many repeated words' };
    }
  }

  return { valid: true };
}

/**
 * Generate unique message ID
 */
export function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Escape RegExp special characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if user is mentioned in message
 */
export function hasMention(content: string, username: string): boolean {
  const escapedUsername = escapeRegExp(username);
  const mentionPattern = new RegExp(`@${escapedUsername}\\b`, 'i');
  return mentionPattern.test(content);
}

/**
 * Toggle message reaction (heart)
 */
export async function toggleMessageReaction(
  messageId: string,
  userId: string
): Promise<{ success: boolean; hearts: number; hearted_by: string[] }> {
  try {
    const { data, error } = await supabase.rpc('toggle_message_reaction', {
      p_message_id: messageId,
      p_user_id: userId
    });

    if (error) {
      console.error('[Chat] Error toggling reaction:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[Chat] Failed to toggle reaction:', error);
    throw error;
  }
}

/**
 * Get message reactions
 */
export async function getMessageReactions(
  messageIds: string[]
): Promise<Record<string, { hearts: number; hearted_by: string[] }>> {
  if (messageIds.length === 0) return {};

  try {
    const { data, error } = await supabase
      .from('message_reactions')
      .select('message_id, hearts, hearted_by')
      .in('message_id', messageIds);

    if (error) {
      console.error('[Chat] Error fetching reactions:', error);
      return {};
    }

    // Convert to record format
    const reactions: Record<string, { hearts: number; hearted_by: string[] }> = {};
    data?.forEach((reaction) => {
      reactions[reaction.message_id] = {
        hearts: reaction.hearts,
        hearted_by: reaction.hearted_by || []
      };
    });

    return reactions;
  } catch (error) {
    console.error('[Chat] Failed to fetch reactions:', error);
    return {};
  }
}
