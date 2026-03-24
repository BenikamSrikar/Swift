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

// Pre-load logo images
const logoImages: Record<string, HTMLImageElement> = {};
let logosLoaded = false;

function preloadLogos(onLoad: () => void) {
  if (logosLoaded) return;
  let count = 0;
  const total = Object.keys(LOGO_URLS).length;
  Object.entries(LOGO_URLS).forEach(([key, url]) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      logoImages[key] = img;
      count++;
      if (count >= total) {
        logosLoaded = true;
        onLoad();
      }
    };
    img.onerror = () => {
      count++;
      if (count >= total) {
        logosLoaded = true;
        onLoad();
      }
    };
    img.src = url;
  });
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
