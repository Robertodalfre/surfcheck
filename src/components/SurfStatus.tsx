import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SurfStatusProps {
  status: 'epic' | 'good' | 'ok' | 'bad';
  message: string;
  subtitle: string;
  onPrev?: () => void;
  onNext?: () => void;
  prevEnabled?: boolean;
  nextEnabled?: boolean;
}

const SurfStatus = ({ status, message, subtitle, onPrev, onNext, prevEnabled = false, nextEnabled = false }: SurfStatusProps) => {
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
    <div className="surf-hero py-12">
      <div className="flex items-center justify-center gap-3">
        <button
          aria-label="Horário anterior"
          className={`p-2 rounded-full border ${prevEnabled ? 'border-zinc-700 text-white/80 hover:bg-zinc-900' : 'border-zinc-800 text-white/40 cursor-not-allowed'}`}
          onClick={onPrev}
          disabled={!prevEnabled}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className={getStatusClass()}>
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
      <p className={`text-xl md:text-2xl font-semibold ${getSubtitleColor()}`}>
        {subtitle}
      </p>
    </div>
  );
};

export default SurfStatus;
