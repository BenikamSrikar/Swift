

/* ═══════════════════════════════════════════
   1. SECURE — padlock that animates from
      unlocked → locked on mount
   ═══════════════════════════════════════════ */
export function SecureIcon({ revealed }: { revealed: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Lock body */}
      <rect x="50" y="95" width="100" height="80" rx="12" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="5" />
      {/* Keyhole */}
      <circle cx="100" cy="130" r="10" fill="hsl(355,82%,56%)" />
      <rect x="96" y="130" width="8" height="18" rx="3" fill="hsl(355,82%,56%)" />
      {/* Shackle — animates from open (rotated) to closed */}
      <path
        d="M70,95 V70 C70,45 130,45 130,70 V95"
        fill="none"
        stroke="hsl(355,82%,56%)"
        strokeWidth="5"
        strokeLinecap="round"
        className={`secure-shackle ${revealed ? 'secure-lock' : ''}`}
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   2. WIDEBAND — signal wave spectrum with
      expanding frequency bands
   ═══════════════════════════════════════════ */
export function WidebandIcon({ revealed }: { revealed: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Central antenna / broadcast point */}
      <circle cx="100" cy="100" r="8" fill="hsl(355,82%,56%)" />
      <line x1="100" y1="100" x2="100" y2="60" stroke="hsl(355,82%,56%)" strokeWidth="4" strokeLinecap="round" />
      <line x1="90" y1="68" x2="100" y2="55" stroke="hsl(355,82%,56%)" strokeWidth="3" strokeLinecap="round" />
      <line x1="110" y1="68" x2="100" y2="55" stroke="hsl(355,82%,56%)" strokeWidth="3" strokeLinecap="round" />

      {/* Wideband signal arcs — left */}
      <path d="M75,85 Q60,100 75,115" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="3.5" strokeLinecap="round" className="wb-arc wb-arc-1" />
      <path d="M60,72 Q38,100 60,128" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="3" strokeLinecap="round" className="wb-arc wb-arc-2" />
      <path d="M45,60 Q16,100 45,140" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="2.5" strokeLinecap="round" className="wb-arc wb-arc-3" />

      {/* Wideband signal arcs — right */}
      <path d="M125,85 Q140,100 125,115" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="3.5" strokeLinecap="round" className="wb-arc wb-arc-1" />
      <path d="M140,72 Q162,100 140,128" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="3" strokeLinecap="round" className="wb-arc wb-arc-2" />
      <path d="M155,60 Q184,100 155,140" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="2.5" strokeLinecap="round" className="wb-arc wb-arc-3" />

      {/* Frequency band indicators at bottom */}
      <rect x="40" y="155" width="16" height="20" rx="2" fill="hsl(355,82%,56%)" opacity="0.3" className="freq-bar fb-1" />
      <rect x="62" y="150" width="16" height="25" rx="2" fill="hsl(355,82%,56%)" opacity="0.4" className="freq-bar fb-2" />
      <rect x="84" y="145" width="16" height="30" rx="2" fill="hsl(355,82%,56%)" opacity="0.5" className="freq-bar fb-3" />
      <rect x="106" y="148" width="16" height="27" rx="2" fill="hsl(355,82%,56%)" opacity="0.45" className="freq-bar fb-4" />
      <rect x="128" y="152" width="16" height="23" rx="2" fill="hsl(355,82%,56%)" opacity="0.35" className="freq-bar fb-5" />
      <rect x="150" y="157" width="16" height="18" rx="2" fill="hsl(355,82%,56%)" opacity="0.25" className="freq-bar fb-6" />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   3. INSTANT — stopwatch / timer with
      ticking hand animation
   ═══════════════════════════════════════════ */
export function InstantIcon({ revealed }: { revealed: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Timer body */}
      <circle cx="100" cy="115" r="65" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="5" />
      {/* Top button */}
      <rect x="92" y="38" width="16" height="16" rx="3" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="4" />
      {/* Side button */}
      <line x1="155" y1="75" x2="168" y2="62" stroke="hsl(355,82%,56%)" strokeWidth="4" strokeLinecap="round" />
      {/* Tick marks */}
      <line x1="100" y1="58" x2="100" y2="68" stroke="hsl(355,82%,56%)" strokeWidth="3" strokeLinecap="round" />
      <line x1="100" y1="162" x2="100" y2="172" stroke="hsl(355,82%,56%)" strokeWidth="3" strokeLinecap="round" />
      <line x1="43" y1="115" x2="53" y2="115" stroke="hsl(355,82%,56%)" strokeWidth="3" strokeLinecap="round" />
      <line x1="147" y1="115" x2="157" y2="115" stroke="hsl(355,82%,56%)" strokeWidth="3" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx="100" cy="115" r="5" fill="hsl(355,82%,56%)" />
      {/* Second hand — ticking */}
      <line x1="100" y1="115" x2="100" y2="68" stroke="hsl(355,82%,56%)" strokeWidth="3" strokeLinecap="round" className="timer-hand" />
      {/* Minute hand */}
      <line x1="100" y1="115" x2="130" y2="95" stroke="hsl(355,82%,56%)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      {/* Lightning bolt for "instant" */}
      <polygon points="95,95 105,95 102,108 112,108 92,132 98,115 88,115" fill="hsl(355,82%,56%)" className="instant-bolt" />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   4. FILES & FOLDERS — folder with files
      popping up one by one
   ═══════════════════════════════════════════ */
export function FilesIcon({ revealed }: { revealed: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Folder back */}
      <path d="M30,70 L30,160 L170,160 L170,70 Z" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="4" rx="6" />
      {/* Folder tab */}
      <path d="M30,70 L30,55 L80,55 L90,70" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="4" strokeLinejoin="round" />

      {/* File 1 — pops up first */}
      <g className="file-pop file-pop-1">
        <rect x="50" y="50" width="40" height="52" rx="3" fill="hsl(0,0%,98%)" stroke="hsl(355,82%,56%)" strokeWidth="3" />
        <line x1="58" y1="68" x2="82" y2="68" stroke="hsl(355,82%,56%)" strokeWidth="2" opacity="0.5" />
        <line x1="58" y1="76" x2="78" y2="76" stroke="hsl(355,82%,56%)" strokeWidth="2" opacity="0.5" />
        <line x1="58" y1="84" x2="74" y2="84" stroke="hsl(355,82%,56%)" strokeWidth="2" opacity="0.5" />
        <path d="M78,50 L78,62 L90,62" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="2.5" />
      </g>

      {/* File 2 — pops up second */}
      <g className="file-pop file-pop-2">
        <rect x="100" y="40" width="40" height="52" rx="3" fill="hsl(0,0%,98%)" stroke="hsl(355,82%,56%)" strokeWidth="3" />
        <rect x="108" y="56" width="24" height="16" rx="2" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="2" opacity="0.5" />
        <circle cx="120" cy="64" r="4" fill="hsl(355,82%,56%)" opacity="0.3" />
        <path d="M128,40 L128,52 L140,52" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="2.5" />
      </g>

      {/* File 3 — pops up third */}
      <g className="file-pop file-pop-3">
        <rect x="75" y="30" width="36" height="44" rx="3" fill="hsl(0,0%,98%)" stroke="hsl(355,82%,56%)" strokeWidth="3" />
        <text x="82" y="58" fontSize="12" fontWeight="bold" fill="hsl(355,82%,56%)" fontFamily="monospace">ZIP</text>
        <path d="M100,30 L100,40 L111,40" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="2.5" />
      </g>
    </svg>
  );
}

/* ═══════════════════════════════════════════
   5. TRANSFER — file moving from left
      computer to right computer
   ═══════════════════════════════════════════ */
export function TransferIcon({ revealed }: { revealed: boolean }) {
  return (
    <svg viewBox="0 0 240 180" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Left laptop */}
      <rect x="10" y="50" width="70" height="50" rx="4" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="3.5" />
      <rect x="5" y="100" width="80" height="6" rx="3" fill="hsl(355,82%,56%)" opacity="0.8" />
      {/* Screen content */}
      <rect x="20" y="60" width="20" height="25" rx="2" fill="hsl(355,82%,56%)" opacity="0.2" />
      <line x1="22" y1="90" x2="70" y2="90" stroke="hsl(355,82%,56%)" strokeWidth="1.5" opacity="0.3" />

      {/* Right laptop */}
      <rect x="160" y="50" width="70" height="50" rx="4" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="3.5" />
      <rect x="155" y="100" width="80" height="6" rx="3" fill="hsl(355,82%,56%)" opacity="0.8" />

      {/* Transfer arrow path */}
      <path d="M90,75 C115,45 135,45 150,75" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
      
      {/* Moving file */}
      <g className="transfer-file-move">
        <rect x="-12" y="-16" width="24" height="32" rx="3" fill="hsl(0,0%,98%)" stroke="hsl(355,82%,56%)" strokeWidth="2.5" />
        <line x1="-6" y1="-4" x2="6" y2="-4" stroke="hsl(355,82%,56%)" strokeWidth="1.5" opacity="0.5" />
        <line x1="-6" y1="2" x2="4" y2="2" stroke="hsl(355,82%,56%)" strokeWidth="1.5" opacity="0.5" />
        <line x1="-6" y1="8" x2="8" y2="8" stroke="hsl(355,82%,56%)" strokeWidth="1.5" opacity="0.5" />
        <path d="M4,-16 L4,-8 L12,-8" fill="none" stroke="hsl(355,82%,56%)" strokeWidth="2" />
      </g>

      {/* Particle trail */}
      <circle r="2" fill="hsl(355,82%,56%)" className="transfer-particle tp-1" />
      <circle r="1.5" fill="hsl(355,82%,56%)" className="transfer-particle tp-2" />
      <circle r="2.5" fill="hsl(355,82%,56%)" className="transfer-particle tp-3" />
    </svg>
  );
}
