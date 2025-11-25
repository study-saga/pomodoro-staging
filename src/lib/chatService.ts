/**
 * Build a Discord avatar URL for a user or return an existing full URL; returns `null` if no avatar is available.
 *
 * @param user - Object containing avatar data. `avatar` may be a full URL or a Discord avatar hash; `discord_id` is required when `avatar` is a Discord hash.
 * @returns A fully-qualified avatar URL, or `null` if no avatar can be determined.
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
 * Formats a timestamp into a human-readable message time.
 *
 * Returns "today at <time>" or "yesterday at <time>" when applicable, otherwise returns
 * a short date with time ("Mon D at <time>") for the current year or a long date with year
 * ("Mon D, YYYY at <time>") for previous years. Time is formatted in en-US `h:mm am/pm` style.
 *
 * @param timestamp - The input timestamp as a number (milliseconds since epoch) or an ISO date string.
 * @returns A formatted time string (e.g., "today at 3:04 am", "yesterday at 11:30 pm", "Jan 15 at 2:45 pm", or "Jan 15, 2023 at 2:45 pm").
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
 * Produce a short relative time label for a timestamp suitable for conversation lists.
 *
 * @param timestamp - A numeric millisecond timestamp or an ISO date string
 * @returns A short human-readable label such as `just now`, `2m ago`, `1h ago`, `3d ago`, or a short date like `Jan 5`
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
 * Produce a deterministic conversation ID for a direct message between two users.
 *
 * @returns A string formatted as `dm:<smaller_id>:<larger_id>`, where the two user IDs are sorted lexicographically.
 */
export function getConversationId(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  return `dm:${sorted[0]}:${sorted[1]}`;
}

/**
 * Create a shortened preview of a message.
 *
 * @param text - The message text to truncate
 * @param maxLength - Maximum allowed length of the returned string (default 50)
 * @returns The original `text` if its length is less than or equal to `maxLength`, otherwise a truncated string ending with an ellipsis (`...`)
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
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';

// Initialize Obscenity Matcher
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

// Critical words to check for spaced variations (e.g. "s e x")
// We keep this custom check because standard filters often miss "s e x"
const CRITICAL_SPACED_WORDS = ['sex', 'ass', 'shit', 'fuck', 'bitch', 'nigger', 'cunt', 'hell', 'whore', 'slut'];

/**
 * Detects spaced-out variants of known profane words (for example "s e x") using strict character boundaries.
 *
 * @param text - Input text to scan for spaced profanity
 * @returns `true` if any spaced profanity pattern is found, `false` otherwise
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
 * Validate chat message text against length, spam, link, and profanity rules.
 *
 * @param content - The message text to validate
 * @returns An object with `valid` set to `true` when the message passes all checks; otherwise `valid` is `false` and `error` contains a short reason (e.g., empty message, too long, links not allowed, profanity, excessive newlines, repeated characters/words).
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
 * Create a compact unique identifier for a message.
 *
 * @returns A string composed of the current timestamp in milliseconds, a hyphen, and a 9-character base36 random token (e.g. `1610000000000-abc123xyz`).
 */
export function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Determine whether a username is mentioned in a message.
 *
 * @param content - The message text to search
 * @param username - The username to look for (without the leading `@`)
 * @returns `true` if `content` contains `@<username>` as a case-insensitive, word-boundary mention, `false` otherwise
 */
export function hasMention(content: string, username: string): boolean {
  const mentionPattern = new RegExp(`@${username}\\b`, 'i');
  return mentionPattern.test(content);
}