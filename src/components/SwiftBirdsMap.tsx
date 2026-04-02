import { useEffect, useRef } from 'react';

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
  { x: 180, y: 120 },  // New York
  { x: 140, y: 160 },  // São Paulo
  { x: 320, y: 100 },  // London
  { x: 340, y: 130 },  // Cairo
  { x: 430, y: 110 },  // Mumbai
  { x: 500, y: 130 },  // Singapore
  { x: 540, y: 200 },  // Sydney
  { x: 470, y: 80 },   // Beijing
  { x: 100, y: 100 },  // San Francisco
  { x: 350, y: 85 },   // Moscow
];

function pickRandom<T>(arr: T[], exclude?: T): T {
  let item: T;
  do { item = arr[Math.floor(Math.random() * arr.length)]; } while (item === exclude);
  return item;
}

function createBird(id: number): Bird {
  const from = pickRandom(CITIES);
  const to = pickRandom(CITIES, from);
  return { id, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, progress: 0, speed: 0.002 + Math.random() * 0.003 };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function quadBezier(p0: number, p1: number, p2: number, t: number) {
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
}

export default function SwiftBirdsMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const birdsRef = useRef<Bird[]>([createBird(0), createBird(1), createBird(2)]);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // World map simplified outline path
    const drawMap = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const sx = w / 640;
      const sy = h / 320;

      ctx.save();
      ctx.strokeStyle = 'hsla(355, 82%, 56%, 0.18)';
      ctx.lineWidth = 1;
      ctx.fillStyle = 'hsla(355, 82%, 56%, 0.04)';

      // North America
      ctx.beginPath();
      ctx.moveTo(60*sx, 60*sy); ctx.lineTo(100*sx, 45*sy); ctx.lineTo(140*sx, 50*sy);
      ctx.lineTo(190*sx, 70*sy); ctx.lineTo(200*sx, 100*sy); ctx.lineTo(210*sx, 130*sy);
      ctx.lineTo(180*sx, 150*sy); ctx.lineTo(150*sx, 160*sy); ctx.lineTo(120*sx, 150*sy);
      ctx.lineTo(100*sx, 130*sy); ctx.lineTo(80*sx, 110*sy); ctx.lineTo(50*sx, 80*sy);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // South America
      ctx.beginPath();
      ctx.moveTo(150*sx, 165*sy); ctx.lineTo(170*sx, 170*sy); ctx.lineTo(180*sx, 200*sy);
      ctx.lineTo(165*sx, 240*sy); ctx.lineTo(145*sx, 270*sy); ctx.lineTo(130*sx, 250*sy);
      ctx.lineTo(125*sx, 210*sy); ctx.lineTo(135*sx, 180*sy);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // Europe
      ctx.beginPath();
      ctx.moveTo(290*sx, 50*sy); ctx.lineTo(320*sx, 45*sy); ctx.lineTo(350*sx, 55*sy);
      ctx.lineTo(340*sx, 80*sy); ctx.lineTo(360*sx, 90*sy); ctx.lineTo(330*sx, 105*sy);
      ctx.lineTo(310*sx, 100*sy); ctx.lineTo(295*sx, 90*sy); ctx.lineTo(285*sx, 70*sy);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // Africa
      ctx.beginPath();
      ctx.moveTo(300*sx, 110*sy); ctx.lineTo(330*sx, 105*sy); ctx.lineTo(370*sx, 120*sy);
      ctx.lineTo(380*sx, 160*sy); ctx.lineTo(360*sx, 210*sy); ctx.lineTo(340*sx, 230*sy);
      ctx.lineTo(310*sx, 210*sy); ctx.lineTo(295*sx, 170*sy); ctx.lineTo(290*sx, 140*sy);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // Asia
      ctx.beginPath();
      ctx.moveTo(370*sx, 50*sy); ctx.lineTo(420*sx, 40*sy); ctx.lineTo(480*sx, 50*sy);
      ctx.lineTo(530*sx, 70*sy); ctx.lineTo(540*sx, 100*sy); ctx.lineTo(510*sx, 120*sy);
      ctx.lineTo(470*sx, 130*sy); ctx.lineTo(430*sx, 120*sy); ctx.lineTo(400*sx, 110*sy);
      ctx.lineTo(380*sx, 90*sy); ctx.lineTo(365*sx, 70*sy);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // Australia
      ctx.beginPath();
      ctx.moveTo(500*sx, 190*sy); ctx.lineTo(550*sx, 180*sy); ctx.lineTo(580*sx, 200*sy);
      ctx.lineTo(570*sx, 230*sy); ctx.lineTo(530*sx, 240*sy); ctx.lineTo(505*sx, 220*sy);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      ctx.restore();
    };

    const drawBird = (x: number, y: number, angle: number, size: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = 'hsl(355, 82%, 56%)';
      ctx.beginPath();
      // Bird body
      ctx.moveTo(size, 0);
      ctx.quadraticCurveTo(size * 0.3, -size * 0.15, -size * 0.5, 0);
      ctx.quadraticCurveTo(size * 0.3, size * 0.15, size, 0);
      // Wings
      ctx.moveTo(size * 0.2, 0);
      ctx.quadraticCurveTo(0, -size * 0.7, -size * 0.4, -size * 0.3);
      ctx.moveTo(size * 0.2, 0);
      ctx.quadraticCurveTo(0, size * 0.7, -size * 0.4, size * 0.3);
      ctx.fill();
      // File icon
      ctx.fillStyle = 'hsl(355, 82%, 70%)';
      ctx.fillRect(-size * 0.15, -size * 0.1, size * 0.2, size * 0.15);
      ctx.restore();
    };

    const animate = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const sx = w / 640;
      const sy = h / 320;

      ctx.clearRect(0, 0, w, h);
      drawMap();

      birdsRef.current.forEach((bird, i) => {
        bird.progress += bird.speed;
        if (bird.progress >= 1) {
          birdsRef.current[i] = createBird(bird.id);
          return;
        }

        const bx = bird.fromX * sx;
        const by = bird.fromY * sy;
        const ex = bird.toX * sx;
        const ey = bird.toY * sy;
        const cpx = (bx + ex) / 2;
        const cpy = Math.min(by, ey) - 40 * sy;

        const x = quadBezier(bx, cpx, ex, bird.progress);
        const y = quadBezier(by, cpy, ey, bird.progress);
        const nx = quadBezier(bx, cpx, ex, Math.min(bird.progress + 0.02, 1));
        const ny = quadBezier(by, cpy, ey, Math.min(bird.progress + 0.02, 1));
        const angle = Math.atan2(ny - y, nx - x);

        // Trail
        ctx.save();
        const trailSteps = 12;
        for (let t = 0; t < trailSteps; t++) {
          const tp = bird.progress - t * 0.02;
          if (tp < 0) break;
          const tx = quadBezier(bx, cpx, ex, tp);
          const ty = quadBezier(by, cpy, ey, tp);
          ctx.beginPath();
          ctx.arc(tx, ty, 1.5 * (1 - t / trailSteps), 0, Math.PI * 2);
          ctx.fillStyle = `hsla(355, 82%, 56%, ${0.4 * (1 - t / trailSteps)})`;
          ctx.fill();
        }
        ctx.restore();

        // Dashed path
        ctx.save();
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'hsla(355, 82%, 56%, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(cpx, cpy, ex, ey);
        ctx.stroke();
        ctx.restore();

        drawBird(x, y, angle, 10 * Math.min(sx, sy));
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
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
