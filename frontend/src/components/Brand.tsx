interface BrandProps {
  compact?: boolean;
  iconOnly?: boolean;
  className?: string;
}

export default function Brand({ compact = false, iconOnly = false, className = '' }: BrandProps) {
  const iconSize = compact ? 'h-9 w-9' : 'h-11 w-11';
  const titleSize = compact ? 'text-lg' : 'text-2xl';
  const subtitleSize = compact ? 'text-[11px]' : 'text-xs';

  if (iconOnly) {
    return (
      <img
        src="/favicon.svg"
        alt="DoMaintenance"
        className={`${iconSize} rounded-2xl shadow-sm ${className}`.trim()}
      />
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <img
        src="/favicon.svg"
        alt="DoMaintenance"
        className={`${iconSize} rounded-2xl shadow-sm`}
      />
      <div className="min-w-0">
        <div className={`${titleSize} font-semibold tracking-tight text-gray-950 dark:text-gray-50`}>
          DoMaintenance
        </div>
        <div className={`${subtitleSize} uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400`}>
          Domain Care
        </div>
      </div>
    </div>
  );
}
