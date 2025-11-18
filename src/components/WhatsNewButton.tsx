import { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { changelog, type ChangelogEntry } from '../data/changelog';
import { useDeviceType } from '../hooks/useDeviceType';

const LOAD_MORE_COUNT = 3;

export default function WhatsNewButton() {
  const { isMobile } = useDeviceType();
  const INITIAL_LOAD_COUNT = isMobile ? 4 : 5;

  const [isOpen, setIsOpen] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(INITIAL_LOAD_COUNT);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset displayed count when popover opens
  useEffect(() => {
    if (isOpen) {
      setDisplayedCount(INITIAL_LOAD_COUNT);
    }
  }, [isOpen]);

  // Lazy load more entries when sentinel comes into view
  useEffect(() => {
    if (!sentinelRef.current || !isOpen) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayedCount < changelog.length) {
          setDisplayedCount((prev) => Math.min(prev + LOAD_MORE_COUNT, changelog.length));
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [displayedCount, isOpen]);

  const displayedEntries = changelog.slice(0, displayedCount);
  const hasMore = displayedCount < changelog.length;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="View what's new"
          className={`backdrop-blur-md rounded-full text-white transition-colors bg-white/10 hover:bg-white/20 border border-white/20 z-40 flex items-center gap-2 ${
            isMobile ? 'p-2' : 'p-3'
          }`}
          title="View what's new"
        >
          <Sparkles className="w-[18px] h-[18px]" />
          {!isMobile && <span className="text-sm font-medium pr-1">What's New</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] sm:w-[380px] p-0 bg-gray-900/95 backdrop-blur-xl border-gray-700"
        align="end"
        sideOffset={8}
      >
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles size={20} className="text-purple-400" />
            What's New
          </h2>
          <p className="text-sm text-gray-400 mt-1">Latest updates and features</p>
        </div>

        <ScrollArea className="h-[60vh] sm:h-[400px]" ref={scrollRef}>
          <div className="p-4 space-y-4">
            {displayedEntries.map((entry, index) => (
              <ChangelogItem key={`${entry.date}-${index}`} entry={entry} formatDate={formatDate} />
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center py-4">
                <button
                  onClick={() => setDisplayedCount((prev) => Math.min(prev + LOAD_MORE_COUNT, changelog.length))}
                  className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors text-gray-300"
                >
                  Load {Math.min(LOAD_MORE_COUNT, changelog.length - displayedCount)} More Updates
                </button>
              </div>
            )}

            {/* Sentinel for lazy loading */}
            {hasMore && (
              <div ref={sentinelRef} className="h-px" />
            )}

            {!hasMore && changelog.length > INITIAL_LOAD_COUNT && (
              <div className="py-4 text-center text-sm text-gray-500 border-t border-gray-800">
                You've reached the beginning
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface ChangelogItemProps {
  entry: ChangelogEntry;
  formatDate: (date: string) => string;
}

function ChangelogItem({ entry, formatDate }: ChangelogItemProps) {
  return (
    <div className="group">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-1.5 h-1.5 mt-2 bg-purple-500 rounded-full" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-white font-semibold text-sm leading-tight">{entry.title}</h3>
            <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
              {formatDate(entry.date)}
            </span>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed mb-2">{entry.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <Badge key={tag} variant={tag} className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent mt-4" />
    </div>
  );
}
