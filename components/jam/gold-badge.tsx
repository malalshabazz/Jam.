export function GoldBadge({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      aria-label="Early adopter verified"
      title="Early adopter"
      className={[
        "relative inline-flex shrink-0 items-center justify-center drop-shadow-[0_0_10px_rgba(180,117,18,0.45)]",
        className,
      ].join(" ")}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-full w-full"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="gold-badge-face" x1="5" y1="3" x2="19" y2="21">
            <stop offset="0%" stopColor="#f4d56a" />
            <stop offset="28%" stopColor="#d99a23" />
            <stop offset="62%" stopColor="#a9650f" />
            <stop offset="100%" stopColor="#5c2d06" />
          </linearGradient>
          <radialGradient id="gold-badge-glow" cx="35%" cy="24%" r="72%">
            <stop offset="0%" stopColor="#fff6cf" stopOpacity="0.55" />
            <stop offset="34%" stopColor="#e8b846" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path
          d="m12 1.5 1.75 3.05 3.16-1.55.34 3.5 3.5.34-1.55 3.16L22.25 12l-3.05 1.75 1.55 3.16-3.5.34-.34 3.5-3.16-1.55L12 22.25l-1.75-3.05-3.16 1.55-.34-3.5-3.5-.34 1.55-3.16L1.75 12l3.05-1.75-1.55-3.16 3.5-.34.34-3.5 3.16 1.55L12 1.5Z"
          fill="url(#gold-badge-face)"
        />
        <path
          d="m12 2.35 1.48 2.58.22.39.4-.2 2.67-1.31.28 2.96.05.44.44.04 2.96.29-1.31 2.66-.2.4.39.22 2.58 1.48-2.58 1.48-.39.22.2.4 1.31 2.66-2.96.29-.44.04-.05.44-.28 2.96-2.67-1.31-.4-.2-.22.39L12 21.65l-1.48-2.58-.22-.39-.4.2-2.67 1.31-.28-2.96-.05-.44-.44-.04-2.96-.29 1.31-2.66.2-.4-.39-.22L2.04 12l2.58-1.48.39-.22-.2-.4L3.5 7.24l2.96-.29.44-.04.05-.44.28-2.96L9.9 4.82l.4.2.22-.39L12 2.35Z"
          fill="url(#gold-badge-glow)"
        />
        <path
          d="M6.65 7.4c1.55-2.25 4.46-3.36 7.07-2.74 1.04.25 1.95.75 2.64 1.42-3.22-.78-6.54.1-9.71 1.32Z"
          fill="white"
          opacity="0.2"
        />
        <path
          d="m7.15 12.3 3.05 3.05 6.65-7.05"
          stroke="#ffffff"
          strokeWidth="2.55"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
