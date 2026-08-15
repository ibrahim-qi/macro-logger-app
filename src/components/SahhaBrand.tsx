import React from 'react';

type BrandSize = 'sm' | 'md' | 'lg';
type BrandVariant = 'header' | 'header-center' | 'hero' | 'mark';

interface SahhaBrandProps {
  size?: BrandSize;
  variant?: BrandVariant;
  logoSrc?: string;
  showTagline?: boolean;
  showWordmark?: boolean;
  tagline?: string;
  className?: string;
}

export const LOGO_SRC = '/sahha-logo.png';

const headerMark = {
  sm: 'brand-mark--header-sm',
  md: 'brand-mark--header-md',
  lg: 'brand-mark--header-lg',
} as const;

const headerCenterMark = {
  sm: 'brand-mark--header-center-sm',
  md: 'brand-mark--header-center-md',
  lg: 'brand-mark--header-center-lg',
} as const;

const heroMark = {
  sm: 'brand-mark--hero-sm',
  md: 'brand-mark--hero-md',
  lg: 'brand-mark--hero-lg',
} as const;

export function SahhaMark({
  className = '',
  src = LOGO_SRC,
  glow = false,
}: {
  className?: string;
  src?: string;
  glow?: boolean;
}) {
  return (
    <img
      src={src}
      alt=""
      className={`brand-mark ${glow ? 'brand-mark--glow' : ''} ${className}`.trim()}
      draggable={false}
    />
  );
}

interface SahhaWordmarkProps {
  className?: string;
  size?: 'header' | 'hero';
}

export function SahhaWordmark({ className = '', size = 'header' }: SahhaWordmarkProps) {
  return (
    <span className={`sahha-logo sahha-logo--${size} ${className}`.trim()} aria-hidden="true">
      <span className="sahha-logo__word">Soha</span>
    </span>
  );
}

const SahhaBrand: React.FC<SahhaBrandProps> = ({
  size = 'md',
  variant = 'header',
  logoSrc = LOGO_SRC,
  showTagline = false,
  showWordmark = true,
  tagline = 'Speak naturally. Review with confidence.',
  className = '',
}) => {
  const wordmarkClass =
    variant === 'hero'
      ? 'brand-wordmark--hero'
      : variant === 'header-center'
        ? 'brand-wordmark--header-center'
        : 'brand-wordmark--header';

  const lockupText = showWordmark ? (
    <span className={`brand-wordmark ${wordmarkClass}`.trim()} aria-hidden="true">
      Soha
    </span>
  ) : null;

  if (variant === 'mark') {
    return (
      <div className={`brand-lockup brand-lockup--mark ${className}`.trim()} aria-label="Soha">
        <SahhaMark src={logoSrc} className={headerMark[size]} glow />
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div
        className={`brand-lockup brand-lockup--hero brand-lockup--${size} ${className}`.trim()}
        aria-label="Soha"
      >
        <SahhaMark src={logoSrc} className={heroMark[size]} glow />
        {lockupText}
        {showTagline && (
          <>
            <p className="brand-tagline">{tagline}</p>
            <div className="brand-divider" aria-hidden />
          </>
        )}
      </div>
    );
  }

  if (variant === 'header-center') {
    return (
      <div
        className={`brand-lockup brand-lockup--header-center brand-lockup--integrated brand-lockup--${size} ${className}`.trim()}
        aria-label="Soha"
      >
        <SahhaMark src={logoSrc} className={headerCenterMark[size]} glow />
        {lockupText}
      </div>
    );
  }

  return (
    <div
      className={`brand-lockup brand-lockup--header brand-lockup--integrated brand-lockup--${size}${
        !showWordmark ? ' brand-lockup--mark-only' : ''
      } ${className}`.trim()}
      aria-label="Soha"
    >
      <SahhaMark src={logoSrc} className={headerMark[size]} glow={showWordmark} />
      {lockupText}
    </div>
  );
};

export default SahhaBrand;
