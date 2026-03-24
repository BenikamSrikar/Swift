import { useEffect, useRef } from 'react';

const COLORS = {
  red: 'hsl(355, 82%, 56%)',
  redGlow: 'hsla(355, 82%, 56%, 0.3)',
  dark: 'hsl(0, 0%, 10%)',
  darkMuted: 'hsl(0, 0%, 25%)',
  white: 'hsl(0, 0%, 95%)',
  edge: 'hsla(355, 82%, 56%, 0.4)',
};

const LOGO_URLS: Record<string, string> = {
  chrome: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Google_Chrome_icon_%28February_2022%29.svg/120px-Google_Chrome_icon_%28February_2022%29.svg.png',
  firefox: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Firefox_logo%2C_2019.svg/120px-Firefox_logo%2C_2019.svg.png',
  safari: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Safari_browser_logo.svg/120px-Safari_browser_logo.svg.png',
};

interface Laptop {
  x: number;
  y: number;
  label: string;
  icon: 'chrome' | 'firefox' | 'safari';
}

function drawChromeLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const colors = ['#EA4335', '#34A853', '#FBBC05'];
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const sa = (i * 2 * Math.PI) / 3 - Math.PI / 2;
    const ea = ((i + 1) * 2 * Math.PI) / 3 - Math.PI / 2;
    ctx.arc(cx, cy, r, sa, ea);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = '#4285F4';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

function drawFirefoxLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // Orange-yellow globe
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  grad.addColorStop(0, '#FFBD4F');
  grad.addColorStop(0.5, '#FF980E');
  grad.addColorStop(1, '#FF3750');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Inner blue-purple globe
  const inner = ctx.createRadialGradient(cx + r * 0.1, cy + r * 0.1, 0, cx, cy, r * 0.65);
  inner.addColorStop(0, '#510097');
  inner.addColorStop(1, '#351377');
  ctx.beginPath();
  ctx.arc(cx + r * 0.05, cy + r * 0.05, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = inner;
  ctx.fill();

  // Fox tail wrap (orange arc)
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.85, -Math.PI * 0.3, Math.PI * 1.2);
  ctx.strokeStyle = '#FF6611';
  ctx.lineWidth = r * 0.25;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawSafariLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  grad.addColorStop(0, '#5AC8FA');
  grad.addColorStop(1, '#007AFF');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.65);
  ctx.lineTo(r * 0.12, 0);
  ctx.lineTo(-r * 0.12, 0);
  ctx.closePath();
  ctx.fillStyle = '#FF3B30';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, r * 0.65);
  ctx.lineTo(r * 0.12, 0);
  ctx.lineTo(-r * 0.12, 0);
  ctx.closePath();
  ctx.fillStyle = '#ccc';
  ctx.fill();
  ctx.restore();
}

function drawLaptop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  icon: string,
  scale: number
) {
  const w = 70 * scale;
  const h = 46 * scale;
  const baseH = 8 * scale;
  const r = 6 * scale;

  // Screen
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, [r, r, 0, 0]);
  ctx.fillStyle = COLORS.white;
  ctx.fill();
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Screen inner
  const pad = 5 * scale;
  ctx.beginPath();
  ctx.roundRect(x - w / 2 + pad, y - h / 2 + pad, w - pad * 2, h - pad * 2 - 2, [3, 3, 0, 0]);
  ctx.fillStyle = 'hsl(0, 0%, 96%)';
  ctx.fill();
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Browser logo on screen
  const logoSize = 10 * scale;
  const ly = y - 4 * scale;
  if (icon === 'chrome') {
    drawChromeLogo(ctx, x, ly, logoSize);
  } else if (icon === 'firefox') {
    drawFirefoxLogo(ctx, x, ly, logoSize);
  } else {
    drawSafariLogo(ctx, x, ly, logoSize);
  }

  // Base
  ctx.beginPath();
  ctx.roundRect(x - w / 2 - 6 * scale, y + h / 2, w + 12 * scale, baseH, [0, 0, r, r]);
  ctx.fillStyle = COLORS.white;
  ctx.fill();
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawCenterHub(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  pulse: number
) {
  // Outer glow
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 38 * scale);
  grad.addColorStop(0, `hsla(355, 82%, 56%, ${0.15 + pulse * 0.1})`);
  grad.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(cx, cy, 38 * scale, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Circle
  ctx.beginPath();
  ctx.arc(cx, cy, 22 * scale, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.white;
  ctx.fill();
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 2.5 * scale;
  ctx.stroke();

  // Text
  ctx.fillStyle = COLORS.red;
  ctx.font = `bold ${10 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SHIFT', cx, cy);
}

function drawEdge(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  progress: number
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Animated dot
  const dx = x2 - x1;
  const dy = y2 - y1;
  const px = x1 + dx * progress;
  const py = y1 + dy * progress;

  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.red;
  ctx.fill();

  // Dot glow
  const glow = ctx.createRadialGradient(px, py, 0, px, py, 12);
  glow.addColorStop(0, COLORS.redGlow);
  glow.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(px, py, 12, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
}

export default function NetworkAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    let frame = 0;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const scale = Math.min(w, h) / 320;

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const radius = 90 * scale;

      // Triangle positions (top, bottom-left, bottom-right)
      const laptops: Laptop[] = [
        { x: cx, y: cy - radius, label: 'Chrome', icon: 'chrome' },
        { x: cx - radius * 0.87, y: cy + radius * 0.5, label: 'Firefox', icon: 'firefox' },
        { x: cx + radius * 0.87, y: cy + radius * 0.5, label: 'Safari', icon: 'safari' },
      ];

      frame++;
      const t = frame / 60;

      // Draw edges: laptop-to-hub and laptop-to-laptop
      const edgePairs = [
        [laptops[0], laptops[1]],
        [laptops[1], laptops[2]],
        [laptops[2], laptops[0]],
      ];
      edgePairs.forEach(([a, b], i) => {
        const progress = ((t * 0.4 + i * 0.33) % 1);
        drawEdge(ctx, a.x, a.y, b.x, b.y, progress);
      });

      // Edges to center
      laptops.forEach((l, i) => {
        const progress = ((t * 0.5 + i * 0.33) % 1);
        drawEdge(ctx, l.x, l.y, cx, cy, progress);
      });

      // Center hub
      const pulse = (Math.sin(t * 2) + 1) / 2;
      drawCenterHub(ctx, cx, cy, scale, pulse);

      // Laptops
      laptops.forEach((l) => {
        drawLaptop(ctx, l.x, l.y, l.icon, scale);
      });

      // Labels
      ctx.fillStyle = COLORS.dark;
      ctx.font = `${11 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      laptops.forEach((l) => {
        ctx.fillText(l.label, l.x, l.y + 38 * scale);
      });

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
