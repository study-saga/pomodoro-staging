import { motion } from 'framer-motion';
import { Globe, Clock, AlertCircle, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { requestTimezoneChange } from '../../lib/userSyncAuth';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

// Common timezone choices with default weekend days
const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)', weekendDays: [0, 6] },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)', weekendDays: [0, 6] },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)', weekendDays: [0, 6] },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)', weekendDays: [0, 6] },
  { value: 'America/Anchorage', label: 'Alaska Time', weekendDays: [0, 6] },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time', weekendDays: [0, 6] },
  { value: 'Europe/London', label: 'UK Time (GMT/BST)', weekendDays: [0, 6] },
  { value: 'Europe/Paris', label: 'Central European Time', weekendDays: [0, 6] },
  { value: 'Europe/Athens', label: 'Eastern European Time', weekendDays: [0, 6] },
  { value: 'Asia/Dubai', label: 'UAE Time (Dubai)', weekendDays: [5, 6] }, // Fri-Sat
  { value: 'Asia/Riyadh', label: 'Saudi Arabia Time', weekendDays: [5, 6] }, // Fri-Sat
  { value: 'Asia/Kolkata', label: 'India Time', weekendDays: [0, 6] },
  { value: 'Asia/Singapore', label: 'Singapore Time', weekendDays: [0, 6] },
  { value: 'Asia/Tokyo', label: 'Japan Time', weekendDays: [0, 6] },
  { value: 'Asia/Shanghai', label: 'China Time', weekendDays: [0, 6] },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time', weekendDays: [0, 6] },
  { value: 'Pacific/Auckland', label: 'New Zealand Time', weekendDays: [0, 6] },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', weekendDays: [0, 6] },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface TimezoneTabProps {
  timezone: string;
  weekendDays: number[];
  pendingTimezone: string | null;
  pendingTimezoneAppliesAt: string | null;
  lastTimezoneChangeAt: string | null;
}

export function TimezoneTab(props: TimezoneTabProps) {
  const {
    timezone: currentTimezone,
    weekendDays: currentWeekendDays,
    pendingTimezone,
    pendingTimezoneAppliesAt,
  } = props;

  const { appUser } = useAuth();
  const [selectedTimezone, setSelectedTimezone] = useState(currentTimezone);
  const [selectedWeekendDays, setSelectedWeekendDays] = useState<number[]>(currentWeekendDays);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Reset selection when props change
  useEffect(() => {
    setSelectedTimezone(currentTimezone);
    setSelectedWeekendDays(currentWeekendDays);
  }, [currentTimezone, currentWeekendDays]);

  const handleTimezoneChange = (newTz: string) => {
    setSelectedTimezone(newTz);
    // Auto-update weekend days based on timezone
    const tzConfig = COMMON_TIMEZONES.find(t => t.value === newTz);
    if (tzConfig) {
      setSelectedWeekendDays(tzConfig.weekendDays);
    }
  };

  const handleSubmit = async () => {
    if (!appUser?.id) {
      toast.error('Authentication required');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const result = await requestTimezoneChange(
        appUser.id,
        selectedTimezone,
        selectedWeekendDays
      );

      if (result.status === 'pending') {
        setStatusMessage({
          type: 'success',
          text: result.message
        });
        toast.success(`Timezone change scheduled - applies in ${result.hoursUntilApplied}h`);
      } else {
        setStatusMessage({
          type: 'error',
          text: result.message
        });
        toast.error(result.message);
      }
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        text: error.message || 'Failed to request timezone change'
      });
      toast.error('Failed to request timezone change');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasPendingChange = pendingTimezone !== null;
  const isChanged = selectedTimezone !== currentTimezone ||
    JSON.stringify(selectedWeekendDays) !== JSON.stringify(currentWeekendDays);

  return (
    <motion.div
      key="timezone"
      role="tabpanel"
      id="timezone-panel"
      aria-labelledby="timezone-tab"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Timezone Settings
        </h3>
        <p className="text-sm text-gray-400">
          Set your timezone for accurate weekend buff detection
        </p>
      </div>

      {/* Current Status */}
      <div className="bg-gray-800/50 rounded-lg p-4 space-y-3 w-full max-w-full">
        <div className="flex items-start gap-3 w-full">
          <Clock className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white">Current Timezone</div>
            <div className="text-sm text-gray-300 break-words">{currentTimezone}</div>
            <div className="text-xs text-gray-400 mt-1 break-words">
              Weekend: {currentWeekendDays.map(d => DAY_NAMES[d]).join(', ')}
            </div>
          </div>
        </div>

        {hasPendingChange && (
          <div className="flex items-start gap-3 pt-3 border-t border-gray-700 w-full">
            <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-yellow-400">Pending Change</div>
              <div className="text-sm text-gray-300 break-words">{pendingTimezone}</div>
              <div className="text-xs text-gray-400 mt-1 break-words">
                Applies: {new Date(pendingTimezoneAppliesAt!).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timezone Selection */}
      <div className="space-y-3 w-full max-w-full">
        <label className="block text-sm font-medium text-gray-300">
          Select Timezone
        </label>
        <select
          value={selectedTimezone}
          onChange={(e) => handleTimezoneChange(e.target.value)}
          disabled={isSubmitting}
          className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition disabled:opacity-50 text-sm"
        >
          {COMMON_TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
              {tz.weekendDays[0] === 5 ? ' (Fri-Sat weekend)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Weekend Days Display */}
      <div className="space-y-2 w-full max-w-full">
        <label className="block text-sm font-medium text-gray-300">
          Weekend Days
        </label>
        <div className="flex flex-wrap gap-2 w-full">
          {DAY_NAMES.map((day, index) => (
            <div
              key={day}
              className={`
                px-3 py-1.5 rounded text-xs font-medium transition flex-shrink-0
                ${selectedWeekendDays.includes(index)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400'
                }
              `}
            >
              {day}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          Weekend days are automatically set based on your timezone
        </p>
      </div>

      {/* Rate Limits Info */}
      <div className="bg-gray-800/30 rounded-lg p-4 space-y-2 w-full max-w-full">
        <div className="text-xs text-gray-400 space-y-1">
          <div>⏱️ Changes apply at next midnight (00:00 UTC)</div>
          <div>🔒 14-day cooldown between changes</div>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`
            rounded-lg p-4 flex items-start gap-3 w-full max-w-full
            ${statusMessage.type === 'success' ? 'bg-green-900/30 border border-green-700/50' : ''}
            ${statusMessage.type === 'error' ? 'bg-red-900/30 border border-red-700/50' : ''}
            ${statusMessage.type === 'info' ? 'bg-blue-900/30 border border-blue-700/50' : ''}
          `}
        >
          {statusMessage.type === 'success' && <Check className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />}
          {statusMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />}
          {statusMessage.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />}
          <div className="flex-1 min-w-0 text-sm text-gray-200 break-words">
            {statusMessage.text}
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!isChanged || isSubmitting}
        className={`
          w-full py-3 px-4 rounded-lg font-medium transition
          ${!isChanged || isSubmitting
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
          }
        `}
      >
        {isSubmitting ? 'Requesting...' : 'Request Timezone Change'}
      </button>
    </motion.div>
  );
}
