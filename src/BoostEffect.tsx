import type { CSSProperties } from 'react';
import './BoostEffect.css';

export interface BoostEffectProps {
  active: boolean;
  className?: string;
  /** The downloaded official YouBike website mark. An error shows text instead. */
  logoSrc?: string;
}

const STREAKS = Array.from({ length: 28 }, (_, index) => ({
  angle: (index * 360) / 28 + (index % 3) * 1.8,
  delay: -(index % 9) * 0.13,
  duration: 0.62 + (index % 5) * 0.09,
  length: 8 + (index % 4) * 4,
}));

type StreakStyle = CSSProperties & {
  '--boost-angle': string;
  '--boost-delay': string;
  '--boost-duration': string;
  '--boost-length': string;
};

/**
 * Put inside the same position:relative container as the game canvas.
 * Mounting on false -> true restarts the single activation burst; keeping active
 * true never retriggers it. Gameplay speed/FOV/audio stay in the game engine.
 */
export function BoostEffect({
  active,
  className = '',
  logoSrc = '/branding/youbike-logo.svg',
}: BoostEffectProps) {
  if (!active) return null;

  return (
    <div className={`boost-effect ${className}`} data-testid="boost-effect">
      <div className="boost-effect__visuals" aria-hidden="true">
        <div className="boost-effect__edge-glow" />
        <div className="boost-effect__flash" />
        <div className="boost-effect__burst" />
        <div className="boost-effect__shockwave boost-effect__shockwave--first" />
        <div className="boost-effect__shockwave boost-effect__shockwave--second" />
        <div className="boost-effect__streaks">
          {STREAKS.map((streak, index) => (
            <i
              key={index}
              className="boost-effect__streak"
              style={
                {
                  '--boost-angle': `${streak.angle}deg`,
                  '--boost-delay': `${streak.delay}s`,
                  '--boost-duration': `${streak.duration}s`,
                  '--boost-length': `${streak.length}vmin`,
                } as StreakStyle
              }
            />
          ))}
        </div>
        <div className="boost-effect__cut-in">
          <span>Ultimate activated</span>
          <strong>BOOST!</strong>
          <small>See ya, Coach!</small>
        </div>
      </div>

      <div className="boost-effect__badge" role="status" aria-label="YouBike turbo mode activated">
        <svg className="boost-effect__bolt" viewBox="0 0 24 32" fill="none" aria-hidden="true">
          <path d="M14 0 1 18h10l-2 14 14-19H13L14 0Z" fill="currentColor" />
        </svg>
        <div className="boost-effect__brand">
          <img
            src={logoSrc}
            alt="YouBike"
            draggable={false}
            onError={(event) => {
              event.currentTarget.parentElement?.setAttribute('data-logo-failed', 'true');
            }}
          />
          <span className="boost-effect__brand-fallback">YouBike</span>
        </div>
        <div className="boost-effect__badge-type">
          <strong>BOOST</strong>
          <span>Turbo mode</span>
        </div>
      </div>
    </div>
  );
}

export default BoostEffect;
