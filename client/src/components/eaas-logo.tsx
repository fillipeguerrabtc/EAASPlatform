interface EaasLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "icon" | "wordmark";
  className?: string;
}

export function EaasLogo({ size = "md", variant = "full", className = "" }: EaasLogoProps) {
  const sizes = {
    sm: { icon: 24, text: "text-lg", container: "h-8" },
    md: { icon: 32, text: "text-xl", container: "h-10" },
    lg: { icon: 48, text: "text-3xl", container: "h-16" },
    xl: { icon: 64, text: "text-4xl", container: "h-20" },
  };

  const { icon: iconSize, text: textSize, container: containerHeight } = sizes[size];

  // Modern geometric logo - interconnected hexagons representing "Everything connected"
  const LogoIcon = () => (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
    >
      {/* Background gradient circle */}
      <defs>
        <linearGradient id="eaas-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10A37F" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="eaas-gradient-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10A37F" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      
      {/* Outer glow circle */}
      <circle cx="50" cy="50" r="48" fill="url(#eaas-gradient-light)" />
      
      {/* Central hexagon - represents platform core */}
      <path
        d="M 50 25 L 65 34 L 65 52 L 50 61 L 35 52 L 35 34 Z"
        fill="url(#eaas-gradient)"
        opacity="0.9"
      />
      
      {/* Interconnected nodes - representing "Everything" */}
      <circle cx="50" cy="20" r="5" fill="#10A37F" />
      <circle cx="72" cy="35" r="5" fill="#8B5CF6" />
      <circle cx="72" cy="65" r="5" fill="#3B82F6" />
      <circle cx="50" cy="80" r="5" fill="#10A37F" />
      <circle cx="28" cy="65" r="5" fill="#8B5CF6" />
      <circle cx="28" cy="35" r="5" fill="#3B82F6" />
      
      {/* Connection lines - subtle */}
      <line x1="50" y1="25" x2="50" y2="20" stroke="#10A37F" strokeWidth="2" opacity="0.4" />
      <line x1="65" y1="34" x2="72" y2="35" stroke="#8B5CF6" strokeWidth="2" opacity="0.4" />
      <line x1="65" y1="52" x2="72" y2="65" stroke="#3B82F6" strokeWidth="2" opacity="0.4" />
      <line x1="50" y1="61" x2="50" y2="80" stroke="#10A37F" strokeWidth="2" opacity="0.4" />
      <line x1="35" y1="52" x2="28" y2="65" stroke="#8B5CF6" strokeWidth="2" opacity="0.4" />
      <line x1="35" y1="34" x2="28" y2="35" stroke="#3B82F6" strokeWidth="2" opacity="0.4" />
    </svg>
  );

  const Wordmark = () => (
    <div className={`font-bold tracking-tight ${textSize} flex items-baseline gap-1`}>
      <span className="bg-gradient-to-r from-emerald-600 via-purple-600 to-blue-600 bg-clip-text text-transparent dark:from-emerald-500 dark:via-purple-500 dark:to-blue-500">
        EAAS
      </span>
      <span className="text-xs text-muted-foreground font-normal tracking-normal">
        platform
      </span>
    </div>
  );

  if (variant === "icon") {
    return (
      <div className={`${containerHeight} flex items-center ${className}`}>
        <LogoIcon />
      </div>
    );
  }

  if (variant === "wordmark") {
    return (
      <div className={`${containerHeight} flex items-center ${className}`}>
        <Wordmark />
      </div>
    );
  }

  return (
    <div className={`${containerHeight} flex items-center gap-3 ${className}`}>
      <LogoIcon />
      <Wordmark />
    </div>
  );
}
