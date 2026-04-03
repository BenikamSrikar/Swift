import { useEffect, useRef, useState } from 'react';

function BrowserTriangleAnimation() {
  const [activeBrowser, setActiveBrowser] = useState(0);
  const [pulsePhase, setPulsePhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setActiveBrowser((p) => (p + 1) % 3), 2200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setPulsePhase((p) => (p + 1) % 100), 50);
    return () => clearInterval(interval);
  }, []);

  const browsers = [
    { name: 'Chrome', x: 250, y: 55 },
    { name: 'Firefox', x: 105, y: 260 },
    { name: 'Safari', x: 395, y: 260 },
  ];

  const centerX = (browsers[0].x + browsers[1].x + browsers[2].x) / 3;
  const centerY = (browsers[0].y + browsers[1].y + browsers[2].y) / 3;

  return (
    <svg viewBox="0 0 500 340" className="w-full max-w-md" overflow="visible">
      {/* Background network dots */}
      {[
        { x: 35, y: 55 }, { x: 465, y: 75 }, { x: 25, y: 195 },
        { x: 475, y: 175 }, { x: 65, y: 320 }, { x: 435, y: 320 },
        { x: 250, y: 330 }, { x: 448, y: 125 },
      ].map((dot, i) => (
        <circle key={i} cx={dot.x} cy={dot.y} r={2.5}
          fill="hsl(355, 82%, 56%)" opacity={0.25} />
      ))}

      {/* Grey background network lines */}
      <line x1={448} y1={125} x2={465} y2={75} stroke="hsl(0,0%,82%)" strokeWidth={0.8} />
      <line x1={435} y1={320} x2={475} y2={175} stroke="hsl(0,0%,82%)" strokeWidth={0.8} />
      <line x1={25} y1={195} x2={35} y2={55} stroke="hsl(0,0%,82%)" strokeWidth={0.8} />

      {/* Triangle connection lines between laptops */}
      {[
        [browsers[0], browsers[1]],
        [browsers[1], browsers[2]],
        [browsers[2], browsers[0]],
      ].map(([from, to], i) => (
        <line key={`tri-${i}`}
          x1={from.x} y1={from.y + 30} x2={to.x} y2={to.y - 30}
          stroke="hsla(355, 82%, 56%, 0.2)" strokeWidth={1.5} />
      ))}

      {/* Lines from laptops to center */}
      {browsers.map((b, i) => (
        <line key={`hub-${i}`}
          x1={b.x} y1={b.y} x2={centerX} y2={centerY}
          stroke="hsla(355, 82%, 56%, 0.12)" strokeWidth={1}
          strokeDasharray="4 3" />
      ))}

      {/* Mid-line dots */}
      {[
        [browsers[0], browsers[1]],
        [browsers[1], browsers[2]],
        [browsers[2], browsers[0]],
      ].map(([from, to], i) => {
        const mx = (from.x + to.x) / 2;
        const my = ((from.y + 30) + (to.y - 30)) / 2;
        return <circle key={`mid-${i}`} cx={mx} cy={my} r={3} fill="hsl(355, 82%, 56%)" opacity={0.35} />;
      })}

      {/* Animated traveling dot */}
      {(() => {
        const pairs = [
          [browsers[0], browsers[1]],
          [browsers[1], browsers[2]],
          [browsers[2], browsers[0]],
        ];
        const [from, to] = pairs[activeBrowser];
        return (
          <circle r={4} fill="hsl(355, 82%, 56%)" opacity={0.8}>
            <animate attributeName="cx"
              from={String(from.x)} to={String(to.x)}
              dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="cy"
              from={String(from.y + 30)} to={String(to.y - 30)}
              dur="2.2s" repeatCount="indefinite" />
          </circle>
        );
      })()}

      {/* SWIFT center hub */}
      <circle cx={centerX} cy={centerY} r={30} fill="none"
        stroke="hsl(355, 82%, 56%)" strokeWidth={2} />
      <circle cx={centerX} cy={centerY} r={26} fill="hsla(355, 82%, 56%, 0.04)" />
      <text x={centerX} y={centerY + 5} textAnchor="middle"
        fontSize={13} fontWeight="bold" fill="hsl(355, 82%, 56%)"
        fontFamily="Space Grotesk, sans-serif">
        SWIFT
      </text>

      {/* Laptops with browser icons */}
      {browsers.map((b, i) => {
        const isActive = i === activeBrowser;
        return (
          <g key={b.name}>
            {/* Laptop screen bezel */}
            <rect x={b.x - 45} y={b.y - 28} width={90} height={58} rx={5}
              fill="none" stroke="hsl(355, 82%, 56%)" strokeWidth={1.8} />
            {/* Screen inner */}
            <rect x={b.x - 38} y={b.y - 22} width={76} height={46} rx={3}
              fill={isActive ? 'hsla(355, 82%, 56%, 0.04)' : 'hsl(0, 0%, 98%)'} />
            {/* Laptop base */}
            <path d={`M${b.x - 50} ${b.y + 33} L${b.x - 45} ${b.y + 30} L${b.x + 45} ${b.y + 30} L${b.x + 50} ${b.y + 33} Z`}
              fill="none" stroke="hsl(355, 82%, 56%)" strokeWidth={1.5} />
            <line x1={b.x - 50} y1={b.y + 33} x2={b.x + 50} y2={b.y + 33}
              stroke="hsl(355, 82%, 56%)" strokeWidth={1.5} />

            {/* Browser icons */}
            {i === 0 && (
              /* Chrome */
              <g transform={`translate(${b.x - 12}, ${b.y - 16})`}>
                <circle cx="12" cy="12" r="11" fill="#4285F4" />
                <circle cx="12" cy="12" r="4.5" fill="white" />
                <path d="M12 1.5 L16 9.5 L12 7.5 Z" fill="#EA4335" />
                <path d="M3.5 17 L12 7.5 L8.5 13 Z" fill="#FBBC05" />
                <path d="M20.5 17 L12 7.5 L15.5 13 Z" fill="#34A853" />
              </g>
            )}
            {i === 1 && (
              /* Firefox */
              <g transform={`translate(${b.x - 12}, ${b.y - 16})`}>
                <circle cx="12" cy="12" r="11" fill="#FF7139" />
                <circle cx="12" cy="12" r="6" fill="#FFBD4F" />
                <path d="M7 5 Q12 1 18 5 Q20 9 16 11 Q14 7 9 8 Z" fill="#FF7139" />
              </g>
            )}
            {i === 2 && (
              /* Safari */
              <g transform={`translate(${b.x - 12}, ${b.y - 16})`}>
                <circle cx="12" cy="12" r="11" fill="#006CFF" />
                <circle cx="12" cy="12" r="8.5" fill="white" />
                <polygon points="12,4 13,10.5 12,20 11,10.5" fill="#FF3B30" />
                <polygon points="12,20 13,13.5 12,4 11,13.5" fill="#C8C8C8" />
              </g>
            )}

            {/* Callout label */}
            {(() => {
              const labelX = i === 0 ? b.x + 65 : i === 1 ? b.x - 75 : b.x + 65;
              const labelY = i === 0 ? b.y - 8 : i === 1 ? b.y + 48 : b.y + 48;
              const lineStartX = i === 0 ? b.x + 45 : i === 1 ? b.x - 45 : b.x + 45;
              const lineStartY = i === 0 ? b.y - 5 : b.y + 33;
              return (
                <g>
                  <line x1={lineStartX} y1={lineStartY} x2={labelX - (i === 1 ? -5 : 5)} y2={labelY - 4}
                    stroke="hsl(355, 82%, 56%)" strokeWidth={1}
                    strokeDasharray="3 3" opacity={0.5} />
                  <circle cx={lineStartX} cy={lineStartY} r={2} fill="hsl(355, 82%, 56%)" opacity={0.5} />
                  <text x={labelX} y={labelY} fontSize={12} fill="hsl(0,0%,40%)"
                    fontFamily="Space Grotesk, sans-serif" fontWeight="500">
                    {b.name}
                  </text>
                </g>
              );
            })()}
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
