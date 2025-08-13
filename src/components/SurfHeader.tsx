
import { Search, MapPin, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

interface SurfHeaderProps {
  location: string;
  onMenuClick?: () => void;
  onSearchClick?: () => void;
}

const SurfHeader = ({ location, onMenuClick, onSearchClick }: SurfHeaderProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const getUserInitials = (displayName?: string | null) => {
    if (!displayName) return 'U';
    return displayName
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <header className="flex items-center justify-between p-4 pt-8">
      <button
        onClick={() => navigate(user ? '/profile' : '/login')}
        className="p-1.5 rounded-full hover:bg-surface-elevated transition-colors"
        aria-label={user ? 'Perfil' : 'Login'}
      >
        {user ? (
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'Usuário'} />
            <AvatarFallback className="bg-ocean-primary/10 text-ocean-primary">
              {getUserInitials(user.displayName)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <UserIcon className="w-6 h-6 text-ocean-primary" strokeWidth={1.5} />
        )}
      </button>
      
      <div className="flex items-center space-x-2 text-muted-foreground">
        <MapPin className="w-4 h-4" strokeWidth={1.5} />
        <span className="text-sm font-medium">{location}</span>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onSearchClick}
          className="h-8 w-8 rounded-full p-0"
          aria-label="Buscar"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};

export default SurfHeader;
