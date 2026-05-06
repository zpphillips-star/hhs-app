export default function RavenIcon({ size = 100 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 140"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 0 14px rgba(255,140,0,0.35))' }}
    >
      {/* Tail feathers — fanned, layered */}
      <path d="M108,78 L148,60 L138,82 L152,95 L132,88 L140,108 L120,96 L122,118 L108,100 Z"
        fill="rgba(255,140,0,0.85)" />

      {/* Body */}
      <ellipse cx="78" cy="82" rx="38" ry="26"
        transform="rotate(-8 78 82)"
        fill="rgba(255,140,0,0.95)" />

      {/* Head */}
      <circle cx="42" cy="52" r="24" fill="rgba(255,140,0,0.95)" />

      {/* Corvid beak — large, curved downward */}
      <path d="M22,46 Q4,42 2,50 Q4,60 20,58 Q16,52 22,46 Z"
        fill="rgba(255,140,0,0.95)" />

      {/* Wing highlight — subtle feather plane */}
      <path d="M58,70 Q78,58 108,65 Q100,82 78,86 Q65,86 58,70 Z"
        fill="rgba(0,0,0,0.18)" />

      {/* Secondary feather detail */}
      <path d="M62,82 Q80,76 105,80 Q98,92 78,94 Z"
        fill="rgba(0,0,0,0.12)" />

      {/* Eye — white sclera, dark iris, highlight */}
      <circle cx="36" cy="47" r="5.5" fill="var(--bg, #191726)" />
      <circle cx="36" cy="47" r="3.5" fill="rgba(20,12,30,0.95)" />
      <circle cx="34.5" cy="45.5" r="1.2" fill="rgba(255,255,255,0.7)" />

      {/* Legs */}
      <path d="M68,104 L62,124" stroke="rgba(255,140,0,0.9)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M80,106 L74,124" stroke="rgba(255,140,0,0.9)" strokeWidth="3.5" strokeLinecap="round" />

      {/* Front foot claws */}
      <path d="M50,124 L62,124 L70,124" stroke="rgba(255,140,0,0.9)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M60,124 L58,132" stroke="rgba(255,140,0,0.9)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Back foot claws */}
      <path d="M62,124 L74,124 L82,124" stroke="rgba(255,140,0,0.9)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M72,124 L70,132" stroke="rgba(255,140,0,0.9)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
