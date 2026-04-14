import { useEffect, useRef } from 'react';
import worldMapImg from '@/assets/world-map.png';

interface Bird {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  speed: number;
}

const CITIES = [
  { x: 0.21, y: 0.38 },  // New York
  { x: 0.26, y: 0.72 },  // São Paulo
  { x: 0.49, y: 0.30 },  // London
  { x: 0.54, y: 0.47 },  // Cairo
  { x: 0.69, y: 0.46 },  // Mumbai
  { x: 0.76, y: 0.56 },  // Singapore
  { x: 0.86, y: 0.78 },  // Sydney
  { x: 0.79, y: 0.35 },  // Beijing
  { x: 0.15, y: 0.36 },  // San Francisco
  { x: 0.60, y: 0.28 },  // Moscow
  { x: 0.83, y: 0.39 },  // Tokyo
  { x: 0.17, y: 0.49 },  // Mexico City
];

function pickRandom<T>(arr: T[], exclude?: T): T {
  let item: T;
  do { item = arr[Math.floor(Math.random() * arr.length)]; } while (item === exclude);
  return item;
}

function createBird(id: number): Bird {
  const from = pickRandom(CITIES);
  const to = pickRandom(CITIES, from);
  return { id, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, progress: 0, speed: 0.0015 + Math.random() * 0.002 };
}

function quadBezier(p0: number, p1: number, p2: number, t: number) {
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
}

export default function SwiftBirdsMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const birdsRef = useRef<Bird[]>([createBird(0), createBird(1), createBird(2), createBird(3)]);
  const frameRef = useRef<number>(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = worldMapImg;
    imgRef.current = img;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const drawBird = (x: number, y: number, angle: number, size: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = 'hsl(355, 82%, 56%)';
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.quadraticCurveTo(size * 0.5, -size * 0.08, -size * 0.3, 0);
      ctx.quadraticCurveTo(size * 0.5, size * 0.08, size, 0);
      ctx.moveTo(size * 0.3, -size * 0.05);
      ctx.quadraticCurveTo(-size * 0.1, -size * 0.7, -size * 0.55, -size * 0.3);
      ctx.lineTo(-size * 0.15, -size * 0.05);
      ctx.moveTo(size * 0.3, size * 0.05);
      ctx.quadraticCurveTo(-size * 0.1, size * 0.7, -size * 0.55, size * 0.3);
      ctx.lineTo(-size * 0.15, size * 0.05);
      ctx.fill();
      // File icon
      ctx.fillStyle = 'hsla(355, 82%, 80%, 0.9)';
      ctx.fillRect(size * 0.05, -size * 0.07, size * 0.12, size * 0.1);
      ctx.restore();
    };

    const animate = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.clearRect(0, 0, w, h);

      // Draw world map image
      if (imgRef.current && imgRef.current.complete) {
        ctx.globalAlpha = 0.45;
        ctx.drawImage(imgRef.current, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      // City dots
      CITIES.forEach((city) => {
        const cx = city.x * w;
        const cy = city.y * h;
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(355, 82%, 56%, 0.65)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'hsla(355, 82%, 56%, 0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Draw birds
      birdsRef.current.forEach((bird, i) => {
        bird.progress += bird.speed;
        if (bird.progress >= 1) {
          birdsRef.current[i] = createBird(bird.id);
          return;
        }

        const bx = bird.fromX * w;
        const by = bird.fromY * h;
        const ex = bird.toX * w;
        const ey = bird.toY * h;
        const cpx = (bx + ex) / 2;
        const cpy = Math.min(by, ey) - h * 0.15;

        const x = quadBezier(bx, cpx, ex, bird.progress);
        const y = quadBezier(by, cpy, ey, bird.progress);
        const nx = quadBezier(bx, cpx, ex, Math.min(bird.progress + 0.02, 1));
        const ny = quadBezier(by, cpy, ey, Math.min(bird.progress + 0.02, 1));
        const angle = Math.atan2(ny - y, nx - x);

        // Dashed flight path
        ctx.save();
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'hsla(355, 82%, 56%, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(cpx, cpy, ex, ey);
        ctx.stroke();
        ctx.restore();

        // Trail
        for (let t = 0; t < 20; t++) {
          const tp = bird.progress - t * 0.012;
          if (tp < 0) break;
          const tx = quadBezier(bx, cpx, ex, tp);
          const ty = quadBezier(by, cpy, ey, tp);
          const alpha = 0.45 * (1 - t / 20);
          const r = 2.2 * (1 - t / 20);
          ctx.beginPath();
          ctx.arc(tx, ty, r, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(355, 82%, 56%, ${alpha})`;
          ctx.fill();
        }

        drawBird(x, y, angle, 18);
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    img.onload = () => { frameRef.current = requestAnimationFrame(animate); };
    if (img.complete) frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ minHeight: 300 }}
    />
  );
}
