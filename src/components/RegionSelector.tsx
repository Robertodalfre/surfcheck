import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useRegions, Region, RegionSpot } from '@/hooks/useRegions';

interface RegionSelectorProps {
  selectedRegion: string;
  onRegionChange: (region: string) => void;
  selectedSpots?: string[];
  onSpotsChange?: (spots: string[]) => void;
  showSpotSelection?: boolean;
}

const REGION_ICONS: Record<string, string> = {
  ubatuba: '🏖️',
  sao_sebastiao: '🌊',
  florianopolis: '🏄‍♂️',
  rio_de_janeiro: '🏙️'
};

const REGION_DESCRIPTIONS: Record<string, string> = {
  ubatuba: 'Litoral Norte de SP - 10 picos variados',
  sao_sebastiao: 'Costa paulista - 4 picos clássicos',
  florianopolis: 'Ilha da Magia - 5 picos icônicos',
  rio_de_janeiro: 'Cidade Maravilhosa - 6 picos urbanos'
};

export default function RegionSelector({ 
  selectedRegion, 
  onRegionChange, 
  selectedSpots = [], 
  onSpotsChange,
  showSpotSelection = false 
}: RegionSelectorProps) {
  const { regions, loading, error, getRegionSpots } = useRegions();
  const [regionSpots, setRegionSpots] = useState<RegionSpot[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(false);

  // Carregar spots quando região muda
  useEffect(() => {
    if (!selectedRegion) {
      setRegionSpots([]);
      return;
    }

    const loadSpots = async () => {
      setSpotsLoading(true);
      try {
        const spots = await getRegionSpots(selectedRegion);
        setRegionSpots(spots);
        
        // Se não há spots selecionados, selecionar todos por padrão
        if (showSpotSelection && onSpotsChange && selectedSpots.length === 0) {
          onSpotsChange(spots.map(s => s.id));
        }
      } catch (err) {
        console.error('Erro ao carregar spots:', err);
      } finally {
        setSpotsLoading(false);
      }
    };

    loadSpots();
  }, [selectedRegion, getRegionSpots]);

  const handleSpotToggle = (spotId: string) => {
    if (!onSpotsChange) return;

    const newSpots = selectedSpots.includes(spotId)
      ? selectedSpots.filter(id => id !== spotId)
      : [...selectedSpots, spotId];
    
    onSpotsChange(newSpots);
  };

  const selectedRegionData = regions.find(r => r.id === selectedRegion);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Carregando regiões...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            <p className="font-medium">Erro ao carregar regiões</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Seleção de Região */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🗺️ Escolha sua Região
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedRegion} onValueChange={onRegionChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma região para agendar" />
            </SelectTrigger>
            <SelectContent className="z-[9999] relative radix-select-content">
              {regions.map((region) => (
                <SelectItem key={region.id} value={region.id} className="select-item-debug">
                  <div className="flex items-center gap-2">
                    <span>{REGION_ICONS[region.id] || '📍'}</span>
                    <div>
                      <div className="font-medium">{region.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {REGION_DESCRIPTIONS[region.id] || 'Região de surf'}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Preview da região selecionada */}
          {selectedRegionData && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{REGION_ICONS[selectedRegion] || '📍'}</span>
                <span className="font-medium">{selectedRegionData.name}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {REGION_DESCRIPTIONS[selectedRegion] || 'Região selecionada'}
              </p>
              {regionSpots.length > 0 && (
                <div className="mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {regionSpots.length} picos incluídos
                  </Badge>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seleção de Spots (opcional) */}
      {showSpotSelection && selectedRegion && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🏄‍♂️ Picos da Região
              <Badge variant="outline" className="ml-auto">
                {selectedSpots.length} de {regionSpots.length} selecionados
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {spotsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary"></div>
                <span className="ml-2 text-sm text-muted-foreground">Carregando picos...</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Por padrão, todos os picos da região são incluídos. Desmarque os que não deseja monitorar:
                </Label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                  {regionSpots.map((spot) => (
                    <div
                      key={spot.id}
                      className={`flex items-center justify-between p-2 border rounded cursor-pointer transition-colors ${
                        selectedSpots.includes(spot.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => handleSpotToggle(spot.id)}
                    >
                      <span className="text-sm font-medium">{spot.name}</span>
                      {selectedSpots.includes(spot.id) && (
                        <Badge variant="default" className="text-xs">
                          Incluído
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
                
                {regionSpots.length > 0 && (
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => onSpotsChange?.(regionSpots.map(s => s.id))}
                      className="text-xs text-primary hover:underline"
                    >
                      Selecionar todos
                    </button>
                    <span className="text-xs text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={() => onSpotsChange?.([])}
                      className="text-xs text-primary hover:underline"
                    >
                      Desmarcar todos
                    </button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
