
import { Menu, Search, MapPin } from 'lucide-react';

interface SurfHeaderProps {
  location: string;
  onMenuClick?: () => void;
  onSearchClick?: () => void;
}

const SurfHeader = ({ location, onMenuClick, onSearchClick }: SurfHeaderProps) => {
  return (
    <header className="flex items-center justify-between p-4 pt-8">
      <button 
        onClick={onMenuClick}
        className="p-2 rounded-full hover:bg-surface-elevated transition-colors"
        aria-label="Menu"
      >
        <Menu className="w-6 h-6 text-ocean-primary" strokeWidth={1.5} />
      </button>
      
      <div className="flex items-center space-x-2 text-muted-foreground">
        <MapPin className="w-4 h-4" strokeWidth={1.5} />
        <span className="text-sm font-medium">{location}</span>
      </div>
      
      <button 
        onClick={onSearchClick}
        className="p-2 rounded-full hover:bg-surface-elevated transition-colors"
        aria-label="Buscar"
      >
        <Search className="w-6 h-6 text-ocean-primary" strokeWidth={1.5} />
      </button>
    </header>
  );
};

export default SurfHeader;
