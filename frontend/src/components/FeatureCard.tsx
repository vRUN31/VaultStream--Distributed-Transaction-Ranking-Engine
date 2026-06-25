import { useTilt } from '../hooks/useTilt';

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  isMiddle?: boolean;
}

export function FeatureCard({ icon, title, description, isMiddle }: FeatureCardProps) {
  const { containerRef, cardRef } = useTilt();

  return (
    <div 
      ref={containerRef} 
      className={`tilt-card-container ${isMiddle ? 'h-[360px] md:-my-4 z-10' : 'h-[320px]'}`}
    >
      <div 
        ref={cardRef} 
        className={`glass-card rounded-xl p-8 relative overflow-hidden h-full flex flex-col tilt-card group cursor-crosshair ${isMiddle ? 'middle-card' : ''}`}
      >
        {isMiddle && (
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-black/50 dark:via-white/50 to-transparent"></div>
        )}
        <div className="card-glow"></div>
        <div className="card-content flex flex-col h-full">
          <div className={`w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center mb-6 transition-colors ${
            isMiddle 
              ? 'border border-black/30 dark:border-white/30 shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
              : 'border border-black/10 dark:border-white/10 group-hover:border-black/30 dark:group-hover:border-white/30'
          }`}>
            <span className="material-symbols-outlined text-primary text-[24px]">{icon}</span>
          </div>
          <h3 className="text-headline-md font-headline-md text-primary mb-3">{title}</h3>
          <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed mt-auto">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
