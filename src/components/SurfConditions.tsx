
import { Waves, Navigation, Clock, Wind } from 'lucide-react';

interface ConditionProps {
  waveHeight: string;
  swellDirection: string;
  period: string;
  windSpeed: string;
  windDirection: string;
}

const SurfConditions = ({ 
  waveHeight, 
  swellDirection, 
  period, 
  windSpeed, 
  windDirection 
}: ConditionProps) => {
  return (
    <div className="grid grid-cols-4 gap-4 px-4 py-8">
      <div className="surf-condition-card hover:bg-surface-elevated transition-colors">
        <Waves className="w-6 h-6 text-ocean-primary animate-wave" strokeWidth={1.5} />
        <span className="text-lg font-bold text-foreground">{waveHeight}</span>
        <span className="text-xs text-muted-foreground">Altura</span>
      </div>
      
      <div className="surf-condition-card hover:bg-surface-elevated transition-colors">
        <Navigation className="w-6 h-6 text-ocean-primary" strokeWidth={1.5} />
        <span className="text-lg font-bold text-foreground">{swellDirection}</span>
        <span className="text-xs text-muted-foreground">Swell</span>
      </div>
      
      <div className="surf-condition-card hover:bg-surface-elevated transition-colors">
        <Clock className="w-6 h-6 text-ocean-primary" strokeWidth={1.5} />
        <span className="text-lg font-bold text-foreground">{period}s</span>
        <span className="text-xs text-muted-foreground">Período</span>
      </div>
      
      <div className="surf-condition-card hover:bg-surface-elevated transition-colors">
        <Wind className="w-6 h-6 text-ocean-primary" strokeWidth={1.5} />
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">{windSpeed}</div>
          <div className="text-sm text-foreground">{windDirection}</div>
        </div>
        <span className="text-xs text-muted-foreground">Vento</span>
      </div>
    </div>
  );
};

export default SurfConditions;
