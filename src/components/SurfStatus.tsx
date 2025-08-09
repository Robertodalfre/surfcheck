
interface SurfStatusProps {
  status: 'epic' | 'good' | 'ok' | 'bad';
  message: string;
  subtitle: string;
}

const SurfStatus = ({ status, message, subtitle }: SurfStatusProps) => {
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
      <h1 className={getStatusClass()}>
        {message}
      </h1>
      <p className={`text-xl md:text-2xl font-semibold ${getSubtitleColor()}`}>
        {subtitle}
      </p>
    </div>
  );
};

export default SurfStatus;
