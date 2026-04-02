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

// City coordinates mapped to a 800x400 natural earth-like projection
const CITIES = [
  { x: 225, y: 155 },  // New York
  { x: 210, y: 275 },  // São Paulo
  { x: 400, y: 130 },  // London
  { x: 430, y: 185 },  // Cairo
  { x: 545, y: 185 },  // Mumbai
  { x: 610, y: 220 },  // Singapore
  { x: 680, y: 310 },  // Sydney
  { x: 620, y: 145 },  // Beijing
  { x: 140, y: 145 },  // San Francisco
  { x: 470, y: 115 },  // Moscow
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

function quadBezier(p0: number, p1: number, p2: number, t: number) {
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
}

// Real simplified world map SVG path data (Natural Earth inspired outline)
const WORLD_MAP_PATH = `
M 115,135 L 125,120 L 140,115 L 155,110 L 165,105 L 180,108 L 190,115 L 195,125
L 200,118 L 210,112 L 220,108 L 230,110 L 235,118 L 240,125 L 250,130
L 255,140 L 250,148 L 245,155 L 240,160 L 235,158 L 228,162 L 220,170
L 210,175 L 200,178 L 195,182 L 188,180 L 180,175 L 170,168 L 162,162
L 155,158 L 148,155 L 140,152 L 132,148 L 125,142 Z
M 145,110 L 150,95 L 160,88 L 175,82 L 185,78 L 195,80 L 205,85
L 210,78 L 220,72 L 235,68 L 245,72 L 250,80 L 248,88 L 240,95
L 230,100 L 220,105 L 210,108 L 200,110 L 190,112 L 180,108 L 170,105 L 158,108 Z
M 195,195 L 205,190 L 215,192 L 222,200 L 228,210 L 232,225
L 230,240 L 225,255 L 218,268 L 210,275 L 205,280 L 198,285
L 192,278 L 188,265 L 185,250 L 183,235 L 185,220 L 188,208 L 192,200 Z
M 380,95 L 390,88 L 400,85 L 412,82 L 420,85 L 428,90 L 435,95
L 440,102 L 438,110 L 432,118 L 425,125 L 418,128 L 410,130
L 402,128 L 395,122 L 390,115 L 385,108 L 382,100 Z
M 415,140 L 425,135 L 438,138 L 450,142 L 458,148 L 462,158
L 460,170 L 455,182 L 448,195 L 440,208 L 432,218 L 425,228
L 418,235 L 410,232 L 405,222 L 400,210 L 398,198 L 400,185
L 405,172 L 408,160 L 410,150 Z
M 460,80 L 475,72 L 490,68 L 510,65 L 530,62 L 550,65 L 568,70
L 580,78 L 590,85 L 600,92 L 610,98 L 620,105 L 630,112 L 640,118
L 645,128 L 640,138 L 632,145 L 620,150 L 608,152 L 595,155
L 582,158 L 570,160 L 558,158 L 545,155 L 535,150 L 525,145
L 515,140 L 508,135 L 500,128 L 492,120 L 485,112 L 478,105
L 472,98 L 465,90 Z
M 595,165 L 605,162 L 618,165 L 628,172 L 635,180
L 638,190 L 635,200 L 625,205 L 615,208 L 605,210
L 598,205 L 595,195 L 592,185 L 593,175 Z
M 648,275 L 660,268 L 675,265 L 690,268 L 700,278
L 705,290 L 700,302 L 692,312 L 682,318 L 670,320
L 658,315 L 650,305 L 645,292 L 645,282 Z
`;

export default function SwiftBirdsMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const birdsRef = useRef<Bird[]>([createBird(0), createBird(1), createBird(2)]);
  const frameRef = useRef<number>(0);
  const mapPathRef = useRef<Path2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Parse the SVG path into a Path2D
    mapPathRef.current = new Path2D(WORLD_MAP_PATH);

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
      // Bird body - swift-like silhouette
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.quadraticCurveTo(size * 0.5, -size * 0.1, -size * 0.3, 0);
      ctx.quadraticCurveTo(size * 0.5, size * 0.1, size, 0);
      // Left wing (swept back)
      ctx.moveTo(size * 0.3, -size * 0.05);
      ctx.quadraticCurveTo(-size * 0.1, -size * 0.8, -size * 0.6, -size * 0.35);
      ctx.lineTo(-size * 0.15, -size * 0.05);
      // Right wing
      ctx.moveTo(size * 0.3, size * 0.05);
      ctx.quadraticCurveTo(-size * 0.1, size * 0.8, -size * 0.6, size * 0.35);
      ctx.lineTo(-size * 0.15, size * 0.05);
      ctx.fill();
      // Tiny file icon on bird
      ctx.fillStyle = 'hsla(355, 82%, 80%, 0.9)';
      ctx.fillRect(size * 0.05, -size * 0.08, size * 0.15, size * 0.12);
      ctx.restore();
    };

    const animate = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const sx = w / 800;
      const sy = h / 400;

      ctx.clearRect(0, 0, w, h);

      // Draw world map
      ctx.save();
      ctx.scale(sx, sy);
      if (mapPathRef.current) {
        ctx.fillStyle = 'hsla(355, 82%, 56%, 0.06)';
        ctx.fill(mapPathRef.current);
        ctx.strokeStyle = 'hsla(355, 82%, 56%, 0.25)';
        ctx.lineWidth = 1.2;
        ctx.stroke(mapPathRef.current);
      }

      // Draw city dots
      CITIES.forEach((city) => {
        ctx.beginPath();
        ctx.arc(city.x, city.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(355, 82%, 56%, 0.4)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(city.x, city.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'hsla(355, 82%, 56%, 0.15)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });
      ctx.restore();

      // Draw birds
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
        const cpy = Math.min(by, ey) - 50 * sy;

        const x = quadBezier(bx, cpx, ex, bird.progress);
        const y = quadBezier(by, cpy, ey, bird.progress);
        const nx = quadBezier(bx, cpx, ex, Math.min(bird.progress + 0.02, 1));
        const ny = quadBezier(by, cpy, ey, Math.min(bird.progress + 0.02, 1));
        const angle = Math.atan2(ny - y, nx - x);

        // Dashed flight path
        ctx.save();
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = 'hsla(355, 82%, 56%, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(cpx, cpy, ex, ey);
        ctx.stroke();
        ctx.restore();

        // Trail dots
        ctx.save();
        for (let t = 0; t < 15; t++) {
          const tp = bird.progress - t * 0.015;
          if (tp < 0) break;
          const tx = quadBezier(bx, cpx, ex, tp);
          const ty = quadBezier(by, cpy, ey, tp);
          const alpha = 0.5 * (1 - t / 15);
          const r = 2 * (1 - t / 15);
          ctx.beginPath();
          ctx.arc(tx, ty, r, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(355, 82%, 56%, ${alpha})`;
          ctx.fill();
        }
        ctx.restore();

        drawBird(x, y, angle, 12 * Math.min(sx, sy));
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
