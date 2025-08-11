
import { Waves, Navigation, Clock, Wind, Zap } from 'lucide-react';

interface ConditionProps {
  waveHeight: string;
  swellDirection: string;
  period: string;
  windSpeed: string;
  windDirection: string;
  power: string;
}

const SurfConditions = ({ 
  waveHeight, 
  swellDirection, 
  period, 
  windSpeed, 
  windDirection,
  power,
}: ConditionProps) => {
  return (
    <div className="grid grid-cols-5 gap-3 px-4 py-6">
      <div className="surf-condition-card hover:bg-surface-elevated transition-colors">
        <Waves className="w-6 h-6 text-ocean-primary animate-wave" strokeWidth={1.5} />
        <span className="text-base font-bold text-foreground">{waveHeight}</span>
        <span className="text-xs text-muted-foreground">Altura</span>
      </div>
      
      <div className="surf-condition-card hover:bg-surface-elevated transition-colors">
        <Navigation className="w-6 h-6 text-ocean-primary" strokeWidth={1.5} />
        <span className="text-base font-bold text-foreground">{swellDirection}</span>
        <span className="text-xs text-muted-foreground">Swell</span>
      </div>
      
      <div className="surf-condition-card hover:bg-surface-elevated transition-colors">
        <Clock className="w-6 h-6 text-ocean-primary" strokeWidth={1.5} />
        <span className="text-base font-bold text-foreground">{period}s</span>
        <span className="text-xs text-muted-foreground">Período</span>
      </div>
      
      <div className="surf-condition-card hover:bg-surface-elevated transition-colors">
        <Wind className="w-6 h-6 text-ocean-primary" strokeWidth={1.5} />
        <div className="text-center">
          <div className="text-base font-bold text-foreground">{windSpeed}</div>
          <div className="text-xs text-foreground">{windDirection}</div>
        </div>
        <span className="text-xs text-muted-foreground">Vento</span>
      </div>

      <div className="surf-condition-card hover:bg-surface-elevated transition-colors">
        <Zap className="w-6 h-6 text-ocean-primary" strokeWidth={1.5} />
        <span className="text-base font-bold text-foreground">{power}</span>
        <span className="text-xs text-muted-foreground">Força</span>
      </div>
    </div>
  );
};

export default SurfConditions;
