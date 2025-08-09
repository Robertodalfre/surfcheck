
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SurfSpot {
  name: string;
  status: 'good' | 'ok' | 'bad';
  height: string;
}

interface SurfSpotsListProps {
  spots: SurfSpot[];
  onSpotSelect?: (spot: SurfSpot) => void;
}

const SurfSpotsList = ({ spots, onSpotSelect }: SurfSpotsListProps) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <TrendingUp className="w-4 h-4 text-surf-good" strokeWidth={1.5} />;
      case 'ok':
        return <Minus className="w-4 h-4 text-surf-ok" strokeWidth={1.5} />;
      case 'bad':
        return <TrendingDown className="w-4 h-4 text-surf-bad" strokeWidth={1.5} />;
      default:
        return <Minus className="w-4 h-4 text-muted" strokeWidth={1.5} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'border-surf-good/30 hover:border-surf-good/50';
      case 'ok':
        return 'border-surf-ok/30 hover:border-surf-ok/50';
      case 'bad':
        return 'border-surf-bad/30 hover:border-surf-bad/50';
      default:
        return 'border-border/30 hover:border-border/50';
    }
  };

  return (
    <div className="px-4 pb-8">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4 px-1">
        Outros Picos
      </h3>
      <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
        {spots.map((spot, index) => (
          <button
            key={index}
            onClick={() => onSpotSelect?.(spot)}
            className={`surf-spot-chip ${getStatusColor(spot.status)} transition-all hover:scale-105 active:scale-95`}
          >
            <div className="flex items-center space-x-2">
              {getStatusIcon(spot.status)}
              <div className="text-left">
                <div className="font-medium text-foreground">{spot.name}</div>
                <div className="text-xs text-muted-foreground">{spot.height}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SurfSpotsList;
