import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { changelog, type ChangelogEntry } from '../data/changelog';
import { useDeviceType } from '../hooks/useDeviceType';

export default function WhatsNewButton() {
  const { isMobile } = useDeviceType();
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="View what's new"
          className="backdrop-blur-md rounded-full text-white transition-colors bg-black/40 hover:bg-black/60 border border-white/10 z-40 flex items-center gap-2 p-3"
          title="View what's new"
        >
          <Sparkles className="w-6 h-6" />
          {!isMobile && <span className="text-sm font-medium pr-1">What's New</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] sm:w-[380px] p-0 bg-black/40 backdrop-blur-xl border border-white/10"
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

        <ScrollArea className="h-[60vh] sm:h-[400px]">
          <div className="p-4 space-y-4">
            {changelog.map((entry, index) => (
              <ChangelogItem key={`${entry.date}-${index}`} entry={entry} formatDate={formatDate} />
            ))}

            {/* End of list */}
            <div className="py-3 text-center text-xs text-gray-500">
              You've seen all updates
            </div>
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
