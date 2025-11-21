import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, X } from 'lucide-react';
import { useDeviceType } from '../../hooks/useDeviceType';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
} from '../ui/popover';

export const SettingsPopover = memo(function SettingsPopover() {
  const [open, setOpen] = useState(false);
  const { isMobile } = useDeviceType();

  // Trigger button component
  const trigger = (
    <button
      onClick={() => setOpen(true)}
      aria-label="Open settings"
      className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors border border-white/10"
    >
      <SettingsIcon size={24} />
    </button>
  );

  return (
    <>
      {/* Desktop: Popover */}
      {!isMobile && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            {trigger}
          </PopoverTrigger>
          <PopoverContent
            className="bg-gray-900/95 backdrop-blur-xl border-white/10 rounded-2xl w-[480px] p-0 max-h-[85vh]"
            align="end"
            side="bottom"
            sideOffset={8}
          >
            <PopoverBody className="p-0">
              <div className="relative">
                <button
                  onClick={() => setOpen(false)}
                  className="absolute top-3 right-3 z-10 p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                {/* Settings content will go here */}
                <div className="p-4 pt-12">
                  <p className="text-white">Settings content coming soon...</p>
                </div>
              </div>
            </PopoverBody>
          </PopoverContent>
        </Popover>
      )}

      {/* Mobile: Centered Modal */}
      {isMobile && (
        <>
          <div onClick={() => setOpen(!open)}>
            {trigger}
          </div>

          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setOpen(false)}
                />

                {/* Modal Content */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="relative bg-gray-900/95 backdrop-blur-xl border-white/10 border rounded-2xl w-full max-w-xl max-h-[90vh]"
                >
                  <div className="relative">
                    <button
                      onClick={() => setOpen(false)}
                      className="absolute top-3 right-3 z-10 p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {/* Settings content will go here */}
                    <div className="p-4 pt-12">
                      <p className="text-white">Settings content coming soon...</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </>
  );
});
