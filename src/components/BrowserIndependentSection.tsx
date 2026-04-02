import { useEffect, useRef, useState } from 'react';

function BrowserAnimation() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setActive((p) => (p + 1) % 3), 2000);
    return () => clearInterval(interval);
  }, []);

  const browsers = [
    { name: 'Chrome', color: '#4285F4', icon: (
      <g>
        <circle cx="50" cy="50" r="30" fill="#4285F4" />
        <circle cx="50" cy="50" r="12" fill="white" />
        <path d="M50 20 L65 47 L50 38 Z" fill="#EA4335" />
        <path d="M25 65 L50 38 L38 55 Z" fill="#FBBC05" />
        <path d="M75 65 L50 38 L62 55 Z" fill="#34A853" />
      </g>
    )},
    { name: 'Firefox', color: '#FF7139', icon: (
      <g>
        <circle cx="50" cy="50" r="30" fill="#FF7139" />
        <circle cx="50" cy="50" r="16" fill="#FFBD4F" />
        <path d="M40 30 Q50 15 65 30 Q70 40 60 45 Q55 35 45 38 Z" fill="#FF7139" />
      </g>
    )},
    { name: 'Safari', color: '#006CFF', icon: (
      <g>
        <circle cx="50" cy="50" r="30" fill="#006CFF" />
        <circle cx="50" cy="50" r="24" fill="white" />
        <polygon points="50,28 53,47 50,72 47,47" fill="#FF3B30" />
        <polygon points="50,72 53,53 50,28 47,53" fill="#FFFFFF" opacity="0.5" />
      </g>
    )},
  ];

  return (
    <svg viewBox="0 0 300 200" className="w-full max-w-sm">
      {browsers.map((b, i) => {
        const x = 50 + i * 100;
        const isActive = i === active;
        return (
          <g key={b.name} style={{ transition: 'all 0.5s ease' }}>
            {/* Laptop body */}
            <rect x={x - 35} y={80} width={70} height={50} rx={4} fill="hsl(0 0% 92%)" stroke="hsl(0 0% 80%)" strokeWidth={1.5} />
            <rect x={x - 40} y={130} width={80} height={5} rx={2} fill="hsl(0 0% 85%)" />
            {/* Browser icon */}
            <g transform={`translate(${x - 50}, ${isActive ? 10 : 20})`} style={{ transition: 'transform 0.5s ease' }}>
              <g transform="scale(0.6)">{b.icon}</g>
            </g>
            {/* Connection line when active */}
            {isActive && (
              <>
                <line x1={x} y1={60} x2={x} y2={80} stroke="hsl(355, 82%, 56%)" strokeWidth={2} strokeDasharray="4 3" className="animate-pulse" />
                <circle cx={x} cy={70} r={3} fill="hsl(355, 82%, 56%)" className="animate-pulse" />
              </>
            )}
            <text x={x} y={150} textAnchor="middle" fontSize={10} fill="hsl(0 0% 40%)" fontFamily="Space Grotesk">{b.name}</text>
          </g>
        );
      })}
      {/* Connection arcs */}
      <path d="M100 90 Q150 50 200 90" fill="none" stroke="hsla(355, 82%, 56%, 0.2)" strokeWidth={1} strokeDasharray="4 4" />
      <path d="M100 90 Q50 50 200 90" fill="none" stroke="hsla(355, 82%, 56%, 0.1)" strokeWidth={1} strokeDasharray="4 4" />
    </svg>
  );
}

export default function BrowserIndependentSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setRevealed(true); }, { threshold: 0.15 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="min-h-[70vh] flex items-center justify-center px-6 sm:px-12 bg-background"
    >
      <div
        className={`w-full max-w-5xl flex flex-col md:flex-row items-center gap-10 md:gap-20 transition-all duration-700 ${
          revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}
      >
        <div className="flex-1 text-center md:text-left max-w-xl">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 text-foreground">
            <span className="text-primary">Browser</span> Independent
          </h2>
          <p className="text-lg sm:text-xl font-semibold mb-4 text-foreground">
            Works everywhere, no extensions needed.
          </p>
          <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
            SWIFT runs entirely in the browser using native WebRTC APIs. Chrome, Firefox, Safari, Edge — it doesn't matter.
            No plugins, no extensions, no downloads. Open the link, share the code, and start transferring. The same seamless
            experience on any modern browser, any operating system.
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <BrowserAnimation />
        </div>
      </div>
    </section>
  );
}
