/**
 * Date utility functions for consistent date handling across components
 */

/**
 * Calculate days since a given date and format it consistently
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Object with daysSince count and formatted date string
 */
export function calculateDaysSinceDate(dateString: string | null): {
  daysSince: number;
  formattedDate: string;
} {
  if (!dateString) {
    return { daysSince: 0, formattedDate: '' };
  }

  const firstDate = new Date(dateString);
  const today = new Date();

  // Calculate days using simple epoch difference
  const daysSince = Math.floor((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

  // Format consistently across all components
  const formattedDate = firstDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return { daysSince, formattedDate };
}
