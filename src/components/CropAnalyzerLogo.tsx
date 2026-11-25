import React from 'react';

interface CropAnalyzerLogoProps {
  variant?: 'inline' | 'stacked';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ThreeCropWhiteCircleMark: React.FC<{ className?: string }> = ({
  className = 'h-12 w-12',
}) => (
  <svg
    viewBox="0 0 120 120"
    aria-hidden="true"
    className={`shrink-0 ${className}`}
  >
    {/* Crisp white circle with thin green ring so it stands out on light or white surfaces */}
    <circle
      cx="60"
      cy="60"
      r="56"
      fill="#FFFFFF"
      stroke="#1B5E20"
      strokeWidth="3.5"
    />

    {/* Crop 1 (Left): Green Rice Stalk & Grain Panicle */}
    <g strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M38 92 C37 74, 35 58, 30 44 C28 38, 25 34, 22 31"
        fill="none"
        stroke="#1B5E20"
        strokeWidth="3"
      />
      <path
        d="M37 82 C28 74, 23 65, 21 55 C28 61, 34 69, 37 78 Z"
        fill="#2E7D32"
      />
      <path
        d="M37 71 C43 64, 47 57, 48 51 C43 56, 39 62, 37 69 Z"
        fill="#43A047"
      />
      <ellipse cx="31" cy="44" rx="2.6" ry="4.5" transform="rotate(-24 31 44)" fill="#2E7D32" />
      <ellipse cx="26.5" cy="38" rx="2.5" ry="4.2" transform="rotate(-38 26.5 38)" fill="#43A047" />
      <ellipse cx="33.5" cy="37" rx="2.4" ry="4" transform="rotate(-10 33.5 37)" fill="#1B5E20" />
      <ellipse cx="23" cy="33" rx="2.4" ry="4" transform="rotate(-50 23 33)" fill="#2E7D32" />
      <ellipse cx="29" cy="31" rx="2.3" ry="3.8" transform="rotate(-28 29 31)" fill="#43A047" />
    </g>

    {/* Crop 2 (Center): Green Corn Cob in Husk Leaves */}
    <g strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M60 25 C58 20, 57 18, 56 16 M60 25 C60 19, 60.5 17, 60.5 14.5 M60 25 C62 20, 63.5 18, 65 16"
        fill="none"
        stroke="#1B5E20"
        strokeWidth="1.8"
      />
      <path
        d="M60 24 C68.5 24, 72.5 37, 71.5 60 C71 74, 67 87, 60 88.5 C53 87, 49 74, 48.5 60 C47.5 37, 51.5 24, 60 24 Z"
        fill="#43A047"
        stroke="#1B5E20"
        strokeWidth="1.8"
      />
      <path
        d="M54 33 H66 M52 41 H68 M51 49 H69 M51.5 57 H68.5 M52.5 65 H67.5 M56 27 V73 M60 25 V75 M64 27 V73"
        fill="none"
        stroke="#DCFCE7"
        strokeWidth="1.1"
      />
      <path d="M59.5 92 C47 86, 40 69, 42.5 50 C47.5 58, 53 71, 60 83 Z" fill="#1B5E20" />
      <path d="M60.5 92 C73 86, 80 69, 77.5 50 C72.5 58, 67 71, 60 83 Z" fill="#2E7D32" />
      <path d="M60 96 V83" fill="none" stroke="#1B5E20" strokeWidth="3.5" />
    </g>

    {/* Crop 3 (Right): Green Tomato / Leafy Crop */}
    <g strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M84 92 C84 78, 86 66, 89 56"
        fill="none"
        stroke="#1B5E20"
        strokeWidth="3"
      />
      <path
        d="M86 70 C94 64, 102 55, 102 45 C94 47, 87 55, 85 64 Z"
        fill="#43A047"
      />
      <circle
        cx="88"
        cy="54"
        r="11.5"
        fill="#2E7D32"
        stroke="#1B5E20"
        strokeWidth="1.8"
      />
      <path
        d="M82 50 C82.5 46.8, 85.2 44.5, 88.5 44.5"
        fill="none"
        stroke="#A7F3D0"
        strokeWidth="1.5"
      />
      <path
        d="M88 42.5 L84 37.5 L86.8 40.8 L88 35.8 L89.2 40.8 L92.4 37.5 L88 42.5 Z"
        fill="#1B5E20"
      />
      <path
        d="M84.5 80 C77 76, 73.5 70, 73 64.5 C79.5 66.8, 83 72.8, 84.5 79 Z"
        fill="#2E7D32"
      />
    </g>
  </svg>
);

export const CropAnalyzerLogo: React.FC<CropAnalyzerLogoProps> = ({
  variant = 'inline',
  size = 'md',
  className = '',
}) => {
  if (variant === 'stacked') {
    const circleClass =
      size === 'lg' ? 'h-20 w-20' : size === 'sm' ? 'h-12 w-12' : 'h-16 w-16';
    const textClass =
      size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-lg';
    return (
      <div className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
        <ThreeCropWhiteCircleMark className={circleClass} />
        <span
          className={`font-display font-bold tracking-tight whitespace-nowrap leading-none ${textClass}`}
        >
          <span className="text-[#1B5E20]">Crop</span>
          <span className="text-[#111812]">Analyzer</span>
        </span>
      </div>
    );
  }

  const circleClass = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const textClass = size === 'sm' ? 'text-base' : 'text-lg';
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${className}`}>
      <ThreeCropWhiteCircleMark className={circleClass} />
      <span className={`font-display font-bold tracking-tight leading-none ${textClass}`}>
        <span className="text-[#1B5E20]">Crop</span>
        <span className="text-[#111812]">Analyzer</span>
      </span>
    </span>
  );
};
