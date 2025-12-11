import { memo } from 'react';
import { motion } from 'framer-motion';

interface HeartButtonProps {
  count: number;
  isHearted: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export const HeartButton = memo(({ count, isHearted, onToggle, disabled }: HeartButtonProps) => {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      className="group flex items-center gap-1 px-2 py-1 rounded-full transition-all duration-200 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
      title={isHearted ? 'Remove heart' : 'Add heart'}
    >
      <motion.div
        key={isHearted ? 'hearted' : 'not-hearted'}
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      >
        <svg
          viewBox="0 0 16 16"
          className={`transition-all duration-200 ${
            isHearted
              ? 'fill-red-500'
              : 'fill-gray-500 group-hover:fill-gray-400'
          }`}
          height={16}
          width={16}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"
            fillRule="evenodd"
          />
        </svg>
      </motion.div>

      {count > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`text-xs font-medium ${
            isHearted ? 'text-red-400' : 'text-gray-400'
          }`}
        >
          {count}
        </motion.span>
      )}
    </button>
  );
});
