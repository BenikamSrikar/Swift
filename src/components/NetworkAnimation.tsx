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
  const logoSize = 16 * scale;
  const ly = y - 4 * scale;
  const logoImg = logoImages[icon];
  if (logoImg) {
    ctx.drawImage(logoImg, x - logoSize / 2, ly - logoSize / 2, logoSize, logoSize);
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
  ctx.fillText('SWIFT', cx, cy);
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

      // Callout labels with circuit path animation
      const calloutProgress = Math.min(1, t / 1.5); // animate once at start, then stay
      const calloutOffsets = [
        { dx: 50 * scale, dy: -30 * scale },   // Chrome: top-right callout
        { dx: -55 * scale, dy: 25 * scale },   // Firefox: bottom-left callout
        { dx: 55 * scale, dy: 25 * scale },    // Safari: bottom-right callout
      ];

      laptops.forEach((l, i) => {
        const offset = calloutOffsets[i];
        const startX = l.x;
        const startY = l.y + 28 * scale;
        const elbowX = startX + offset.dx * 0.4;
        const elbowY = startY + offset.dy;
        const endX = startX + offset.dx;
        const endY = elbowY;

        // Draw circuit path
        ctx.save();
        ctx.strokeStyle = COLORS.red;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);

        // Vertical segment
        const seg1End = Math.min(1, calloutProgress * 2);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX, startY + (elbowY - startY) * seg1End);
        ctx.stroke();

        // Horizontal segment
        if (calloutProgress > 0.5) {
          const seg2End = Math.min(1, (calloutProgress - 0.5) * 2);
          ctx.beginPath();
          ctx.moveTo(elbowX * 0 + startX, elbowY); // from elbow point (straight down from start)
          ctx.lineTo(startX + (endX - startX) * seg2End, endY);
          ctx.stroke();
        }

        ctx.setLineDash([]);

        // Circuit dot at start
        ctx.beginPath();
        ctx.arc(startX, startY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.red;
        ctx.fill();

        // Label text at the end
        if (calloutProgress >= 1) {
          ctx.fillStyle = COLORS.dark;
          ctx.font = `600 ${10 * scale}px sans-serif`;
          ctx.textAlign = offset.dx > 0 ? 'left' : 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(l.label, endX + (offset.dx > 0 ? 4 : -4) * scale, endY);

          // Small dot at end
          ctx.beginPath();
          ctx.arc(endX, endY, 2, 0, Math.PI * 2);
          ctx.fillStyle = COLORS.red;
          ctx.fill();
        }

        ctx.restore();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    preloadLogos(() => {});
    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
