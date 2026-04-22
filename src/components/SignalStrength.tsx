/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';

type SignalLevel = 'strong' | 'medium' | 'weak';

function getSignalLevel(): SignalLevel {
  const conn = (navigator as any).connection;
  if (conn) {
    const downlink = conn.downlink ?? 10;
    if (downlink >= 5) return 'strong';
    if (downlink >= 1.5) return 'medium';
    return 'weak';
  }
  return navigator.onLine ? 'strong' : 'weak';
}

const barStyles: Record<SignalLevel, { color: string; bars: number }> = {
  strong: { color: 'bg-signal-strong', bars: 4 },
  medium: { color: 'bg-signal-medium', bars: 3 },
  weak: { color: 'bg-signal-weak', bars: 1 },
};

export default function SignalStrength() {
  const [level, setLevel] = useState<SignalLevel>(getSignalLevel);

  useEffect(() => {
    const interval = setInterval(() => setLevel(getSignalLevel()), 3000);
    return () => clearInterval(interval);
  }, []);

  const { color, bars } = barStyles[level];

  return (
    <div className="flex items-end gap-0.5" title={`Signal: ${level}`}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all ${
            i <= bars ? color : 'bg-border'
          }`}
          style={{ height: `${6 + i * 3}px` }}
        />
      ))}
      <span className="ml-1.5 text-[10px] font-mono uppercase text-muted-foreground">
        {level}
      </span>
    </div>
  );
}
