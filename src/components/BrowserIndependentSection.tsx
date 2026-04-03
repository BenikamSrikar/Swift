import { useEffect, useRef, useState } from 'react';

function BrowserTriangleAnimation() {
  const [activeBrowser, setActiveBrowser] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setActiveBrowser((p) => (p + 1) % 3), 2200);
    return () => clearInterval(interval);
  }, []);

  const browsers = [
    { name: 'Chrome', x: 250, y: 30 },
    { name: 'Firefox', x: 100, y: 280 },
    { name: 'Safari', x: 400, y: 280 },
  ];

  const drawLaptop = (cx: number, cy: number, isActive: boolean) => (
    <g>
      {/* Screen bezel */}
      <rect x={cx - 50} y={cy - 35} width={100} height={70} rx={6}
        fill="none" stroke="hsl(355, 82%, 56%)" strokeWidth={2} />
      {/* Screen inner */}
      <rect x={cx - 42} y={cy - 28} width={84} height={56} rx={3}
        fill={isActive ? 'hsla(355, 82%, 56%, 0.05)' : 'hsl(0, 0%, 97%)'} />
      {/* Laptop base */}
      <path d={`M${cx - 55} ${cy + 38} L${cx - 50} ${cy + 35} L${cx + 50} ${cy + 35} L${cx + 55} ${cy + 38} Z`}
        fill="none" stroke="hsl(355, 82%, 56%)" strokeWidth={1.5} />
      <line x1={cx - 55} y1={cy + 38} x2={cx + 55} y2={cy + 38}
        stroke="hsl(355, 82%, 56%)" strokeWidth={1.5} />
    </g>
  );

  const chromeIcon = (cx: number, cy: number) => (
    <g transform={`translate(${cx - 14}, ${cy - 14}) scale(0.07)`}>
      <circle cx="200" cy="200" r="180" fill="#4285F4" />
      <circle cx="200" cy="200" r="70" fill="white" />
      <path d="M200 30 L260 134 L200 120 Z" fill="#EA4335" />
      <path d="M80 300 L200 120 L140 200 Z" fill="#FBBC05" />
      <path d="M320 300 L200 120 L260 200 Z" fill="#34A853" />
    </g>
  );

  const firefoxIcon = (cx: number, cy: number) => (
    <g transform={`translate(${cx - 14}, ${cy - 14}) scale(0.07)`}>
      <circle cx="200" cy="200" r="180" fill="#FF7139" />
      <circle cx="200" cy="200" r="90" fill="#FFBD4F" />
      <path d="M130 80 Q200 20 290 80 Q320 140 260 160 Q230 100 150 120 Z" fill="#FF7139" />
    </g>
  );

  const safariIcon = (cx: number, cy: number) => (
    <g transform={`translate(${cx - 14}, ${cy - 14}) scale(0.07)`}>
      <circle cx="200" cy="200" r="180" fill="#006CFF" />
      <circle cx="200" cy="200" r="140" fill="white" />
      <polygon points="200,70 210,180 200,330 190,180" fill="#FF3B30" />
      <polygon points="200,330 210,220 200,70 190,220" fill="#C8C8C8" />
    </g>
  );

  const browserIcons = [chromeIcon, firefoxIcon, safariIcon];

  // Triangle connection lines between laptops
  const connectionLines = [
    { from: browsers[0], to: browsers[1] },
    { from: browsers[1], to: browsers[2] },
    { from: browsers[2], to: browsers[0] },
  ];

  // Center of triangle for SWIFT hub
  const centerX = (browsers[0].x + browsers[1].x + browsers[2].x) / 3;
  const centerY = (browsers[0].y + browsers[1].y + browsers[2].y) / 3;

  return (
    <svg viewBox="0 0 500 360" className="w-full max-w-md">
      {/* Background network dots */}
      {[
        { x: 30, y: 50 }, { x: 470, y: 80 }, { x: 20, y: 200 },
        { x: 480, y: 180 }, { x: 60, y: 340 }, { x: 440, y: 340 },
        { x: 250, y: 350 }, { x: 450, y: 130 },
      ].map((dot, i) => (
        <circle key={i} cx={dot.x} cy={dot.y} r={2.5}
          fill="hsl(355, 82%, 56%)" opacity={0.25} />
      ))}

      {/* Grey background network lines */}
      <line x1={450} y1={130} x2={470} y2={80} stroke="hsl(0,0%,80%)" strokeWidth={0.8} />
      <line x1={440} y1={340} x2={480} y2={180} stroke="hsl(0,0%,80%)" strokeWidth={0.8} />

      {/* Triangle connection lines */}
      {connectionLines.map((line, i) => (
        <g key={i}>
          <line x1={line.from.x} y1={line.from.y + 38} x2={line.to.x} y2={line.to.y - 35}
            stroke="hsla(355, 82%, 56%, 0.25)" strokeWidth={1.5} />
          {/* Animated dot on active line */}
          {activeBrowser === i && (
            <circle r={4} fill="hsl(355, 82%, 56%)">
              <animate attributeName="cx"
                from={line.from.x} to={line.to.x}
                dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="cy"
                from={String(line.from.y + 38)} to={String(line.to.y - 35)}
                dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity"
                values="1;0.3;1" dur="2.2s" repeatCount="indefinite" />
            </circle>
          )}
        </g>
      ))}

      {/* Lines from laptops to center SWIFT hub */}
      {browsers.map((b, i) => (
        <line key={`hub-${i}`}
          x1={b.x} y1={b.y} x2={centerX} y2={centerY}
          stroke="hsla(355, 82%, 56%, 0.15)" strokeWidth={1}
          strokeDasharray="4 3" />
      ))}

      {/* Center dot at intersections */}
      {connectionLines.map((line, i) => {
        const mx = (line.from.x + line.to.x) / 2;
        const my = ((line.from.y + 38) + (line.to.y - 35)) / 2;
        return <circle key={`mid-${i}`} cx={mx} cy={my} r={3} fill="hsl(355, 82%, 56%)" opacity={0.4} />;
      })}

      {/* SWIFT center hub */}
      <circle cx={centerX} cy={centerY} r={32} fill="none"
        stroke="hsl(355, 82%, 56%)" strokeWidth={2} />
      <circle cx={centerX} cy={centerY} r={28} fill="hsla(355, 82%, 56%, 0.05)" />
      <text x={centerX} y={centerY + 5} textAnchor="middle"
        fontSize={14} fontWeight="bold" fill="hsl(355, 82%, 56%)"
        fontFamily="Space Grotesk, sans-serif">
        SWIFT
      </text>

      {/* Laptops */}
      {browsers.map((b, i) => (
        <g key={b.name}>
          {drawLaptop(b.x, b.y, i === activeBrowser)}
          {browserIcons[i](b.x, b.y)}
        </g>
      ))}

      {/* Browser labels with dashed lines */}
      {browsers.map((b, i) => {
        const labelX = i === 0 ? b.x + 70 : i === 1 ? b.x - 30 : b.x + 70;
        const labelY = i === 0 ? b.y - 5 : b.y + 55;
        return (
          <g key={`label-${i}`}>
            <line
              x1={i === 0 ? b.x + 50 : i === 1 ? b.x - 10 : b.x + 50}
              y1={i === 0 ? b.y - 10 : b.y + 40}
              x2={labelX - 5}
              y2={labelY - 4}
              stroke="hsl(355, 82%, 56%)" strokeWidth={1}
              strokeDasharray="3 3" opacity={0.6} />
            <text x={labelX} y={labelY} fontSize={12} fill="hsl(0,0%,40%)"
              fontFamily="Space Grotesk, sans-serif" fontWeight="500">
              {b.name}
            </text>
          </g>
        );
      })}
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
          <BrowserTriangleAnimation />
        </div>
      </div>
    </section>
  );
}
