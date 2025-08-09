
import SurfHeader from '../components/SurfHeader';
import SurfStatus from '../components/SurfStatus';
import SurfConditions from '../components/SurfConditions';
import SurfSpotsList from '../components/SurfSpotsList';

const Index = () => {
  const currentSpot = {
    location: "Praia do Sapê – Ubatuba",
    status: 'epic' as const,
    message: "Épico!",
    subtitle: "Vai surfar!"
  };

  const conditions = {
    waveHeight: "1.8m",
    swellDirection: "SE",
    period: "12",
    windSpeed: "8km/h",
    windDirection: "SW"
  };

  const otherSpots = [
    { name: "Itamambuca", status: 'good' as const, height: "1.5m" },
    { name: "Félix", status: 'ok' as const, height: "1.0m" },
    { name: "Vermelha do Norte", status: 'bad' as const, height: "0.8m" },
    { name: "Grande", status: 'good' as const, height: "1.3m" },
    { name: "Dura", status: 'ok' as const, height: "1.1m" }
  ];

  const handleMenuClick = () => {
    console.log('Menu clicked');
  };

  const handleSearchClick = () => {
    console.log('Search clicked');
  };

  const handleSpotSelect = (spot: any) => {
    console.log('Selected spot:', spot);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto bg-background">
        <SurfHeader 
          location={currentSpot.location}
          onMenuClick={handleMenuClick}
          onSearchClick={handleSearchClick}
        />
        
        <SurfStatus 
          status={currentSpot.status}
          message={currentSpot.message}
          subtitle={currentSpot.subtitle}
        />
        
        <SurfConditions 
          waveHeight={conditions.waveHeight}
          swellDirection={conditions.swellDirection}
          period={conditions.period}
          windSpeed={conditions.windSpeed}
          windDirection={conditions.windDirection}
        />
        
        <SurfSpotsList 
          spots={otherSpots}
          onSpotSelect={handleSpotSelect}
        />
      </div>
    </div>
  );
};

export default Index;
