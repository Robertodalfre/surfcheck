import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';

interface SurfStatusProps {
  status: 'epic' | 'good' | 'ok' | 'bad';
  message: string;
  subtitle: string;
  onPrev?: () => void;
  onNext?: () => void;
  prevEnabled?: boolean;
  nextEnabled?: boolean;
  onOpenDetails?: () => void;
}

const SurfStatus = ({ status, message, subtitle, onPrev, onNext, prevEnabled = false, nextEnabled = false, onOpenDetails }: SurfStatusProps) => {
  // Swipe handling (mobile)
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (touchStartX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    const threshold = 50; // px
    if (dx <= -threshold && nextEnabled) {
      onNext?.();
    } else if (dx >= threshold && prevEnabled) {
      onPrev?.();
    }
    touchStartX.current = null;
  };
  const getStatusClass = () => {
    switch (status) {
      case 'epic':
        return 'surf-status-epic animate-float';
      case 'good':
        return 'surf-status-good';
      case 'ok':
        return 'surf-status-ok';
      case 'bad':
        return 'surf-status-bad';
      default:
        return 'surf-status-good';
    }
  };

  const getSubtitleColor = () => {
    switch (status) {
      case 'epic':
        return 'text-ocean-accent';
      case 'good':
        return 'text-ocean-primary';
      case 'ok':
        return 'text-yellow-300';
      case 'bad':
        return 'text-red-300';
      default:
        return 'text-ocean-primary';
    }
  };

  return (
    <div
      className="surf-hero py-10 relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Mobile edge arrows */}
      <button
        aria-label="Horário anterior"
        className={`sm:hidden absolute left-1 top-1/2 -translate-y-1/2 p-3 rounded-full border ${prevEnabled ? 'border-zinc-700 text-white/80 bg-black/30 backdrop-blur hover:bg-zinc-900/60' : 'border-zinc-800 text-white/40 cursor-not-allowed'}`}
        onClick={onPrev}
        disabled={!prevEnabled}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        aria-label="Próximo horário"
        className={`sm:hidden absolute right-1 top-1/2 -translate-y-1/2 p-3 rounded-full border ${nextEnabled ? 'border-zinc-700 text-white/80 bg-black/30 backdrop-blur hover:bg-zinc-900/60' : 'border-zinc-800 text-white/40 cursor-not-allowed'}`}
        onClick={onNext}
        disabled={!nextEnabled}
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Desktop/tablet centered arrows */}
      <div className="hidden sm:flex items-center justify-center gap-3">
        <button
          aria-label="Horário anterior"
          className={`p-2 rounded-full border ${prevEnabled ? 'border-zinc-700 text-white/80 hover:bg-zinc-900' : 'border-zinc-800 text-white/40 cursor-not-allowed'}`}
          onClick={onPrev}
          disabled={!prevEnabled}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className={getStatusClass()} onClick={() => onOpenDetails?.()}>
          {message}
        </h1>
        <button
          aria-label="Próximo horário"
          className={`p-2 rounded-full border ${nextEnabled ? 'border-zinc-700 text-white/80 hover:bg-zinc-900' : 'border-zinc-800 text-white/40 cursor-not-allowed'}`}
          onClick={onNext}
          disabled={!nextEnabled}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Message centered on mobile too */}
      <div className="sm:hidden flex items-center justify-center">
        <h1 className={getStatusClass()} onClick={() => onOpenDetails?.()}>{message}</h1>
      </div>

      <p className={`text-xl md:text-2xl font-semibold ${getSubtitleColor()}`} onClick={() => onOpenDetails?.()}>
        {subtitle}
      </p>
    </div>
  );
};

export default SurfStatus;
