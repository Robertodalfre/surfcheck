
import { Waves, Navigation, Clock, Wind, Zap, Bot } from 'lucide-react';

interface ConditionProps {
  waveHeight: string;
  swellDirection: string;
  period: string;
  windSpeed: string;
  windDirection: string;
  power: string;
  // opcionais para "Nota" e cor por temperatura (épico/bom/ok/ruim)
  noteScore?: number | null;
  noteLabel?: string | null;
}

const SurfConditions = ({ 
  waveHeight, 
  swellDirection, 
  period, 
  windSpeed, 
  windDirection,
  power,
  noteScore = null,
  noteLabel = null,
}: ConditionProps) => {
  const tempColor = (() => {
    const lbl = (noteLabel || '').toLowerCase();
    if (lbl.includes('épico')) return 'border-blue-500 text-blue-300 bg-blue-500/15';
    if (lbl.includes('bom') || lbl.includes('ok')) return 'border-yellow-500 text-yellow-300 bg-yellow-500/15';
    if (lbl.includes('ruim')) return 'border-red-500 text-red-300 bg-red-500/15';
    return 'border-zinc-700 text-white/80 bg-zinc-900/40';
  })();
  return (
    <div className="px-4 py-6">
      {/* Grid com 5 colunas para manter todos os 5 cards na mesma linha */}
      <div className="grid grid-cols-5 gap-2">
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

        {/* IA card
        <button
          type="button"
          className="surf-condition-card hover:bg-surface-elevated transition-colors min-w-[150px] snap-start text-left"
          onClick={() => {
            console.log('[IA] Perguntar para IA clicado');
            alert('Em breve: Assistente IA para dicas de pico e horário.');
          }}
        >
          <Bot className="w-6 h-6 text-ocean-primary" strokeWidth={1.5} />
          <span className="text-base font-bold text-foreground">Perguntar para IA</span>
          <span className="text-xs text-muted-foreground">Dicas personalizadas</span>
        </button> */}

        {/* Nota 0-10 com cor por "temperatura" – ocupa linha inteira abaixo */}
        {/* <div className={`surf-condition-card transition-colors border ${tempColor} col-span-5 mt-2`}>
          <div className="text-2xl font-extrabold">
            {noteScore != null ? noteScore : '—'}
          </div>
          <span className="text-xs opacity-80">Nota (0–10)</span>
          <span className="text-[11px] mt-1 px-2 py-0.5 rounded-full border currentColor/20">
            {noteLabel ?? '—'}
          </span>
        </div> */}
      </div>
    </div>
  );
};

export default SurfConditions;
