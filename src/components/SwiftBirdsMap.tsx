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

// City coordinates mapped to an 800x400 projection
const CITIES = [
  { x: 170, y: 150 },  // New York
  { x: 210, y: 290 },  // São Paulo
  { x: 395, y: 120 },  // London
  { x: 430, y: 190 },  // Cairo
  { x: 550, y: 185 },  // Mumbai
  { x: 610, y: 225 },  // Singapore
  { x: 690, y: 310 },  // Sydney
  { x: 630, y: 140 },  // Beijing
  { x: 120, y: 145 },  // San Francisco
  { x: 480, y: 110 },  // Moscow
  { x: 665, y: 155 },  // Tokyo
  { x: 140, y: 195 },  // Mexico City
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

// Accurate world map SVG path - detailed continent outlines (equirectangular ~800x400)
const WORLD_MAP_PATH = `
M120,145 L125,138 L132,132 L140,128 L148,125 L155,120 L162,118 L168,115 L175,112 L180,115 L185,120 L188,125 L192,120 L198,115 L205,112 L210,108 L215,105 L220,102 L225,100 L230,98 L235,100 L238,105 L240,110 L245,112 L250,108 L255,105 L258,100 L260,96 L255,92 L250,88 L245,85 L240,82 L235,80 L230,78 L225,75 L220,72 L215,70 L210,68 L205,70 L200,72 L195,75 L190,78 L185,82 L180,85 L175,88 L170,92 L165,95 L160,98 L155,100 L150,102 L148,108 L145,112 L142,118 L140,125 L135,132 L130,138 L125,142 L120,145 Z
M115,152 L120,148 L128,145 L135,148 L140,152 L145,155 L150,160 L155,165 L160,168 L165,172 L168,178 L170,182 L172,188 L170,192 L168,198 L165,202 L160,205 L155,208 L150,210 L148,215 L145,220 L140,225 L138,230 L142,235 L148,238 L152,242 L155,248 L152,252 L148,258 L145,262 L140,265 L135,268 L130,272 L125,275 L120,278 L115,282 L112,286 L110,290 L108,295 L110,300 L112,305 L115,310 L118,315 L115,320 L112,325 L108,330 L105,335 L100,330 L98,325 L100,320 L102,315 L100,310 L98,305 L95,300 L92,295 L90,290 L92,285 L95,280 L98,275 L100,270 L98,265 L95,260 L92,255 L90,250 L92,245 L95,240 L98,235 L100,230 L102,225 L100,220 L98,215 L95,210 L92,205 L95,200 L98,195 L100,190 L102,185 L105,180 L108,175 L110,170 L112,165 L115,158 Z
M195,192 L200,188 L205,185 L210,188 L215,192 L220,198 L225,205 L228,212 L230,220 L232,228 L235,238 L234,248 L232,258 L228,268 L225,275 L222,282 L218,288 L215,295 L210,300 L205,305 L200,308 L198,312 L195,318 L192,322 L188,325 L185,320 L182,315 L180,308 L178,300 L175,292 L172,282 L170,272 L168,262 L170,252 L172,242 L175,232 L178,222 L180,212 L182,205 L185,198 L190,195 Z
M370,72 L375,68 L380,65 L385,62 L390,60 L395,58 L398,55 L400,52 L405,50 L410,48 L415,50 L418,52 L420,55 L415,58 L410,60 L408,62 L412,65 L415,68 L420,70 L425,68 L430,65 L432,60 L435,58 L438,55 L440,58 L442,62 L438,65 L435,68 L430,72 L425,75 L420,78 L415,80 L410,82 L405,85 L400,88 L395,90 L390,92 L385,95 L380,92 L375,88 L372,82 L370,78 Z
M360,95 L365,92 L370,95 L375,98 L380,102 L385,105 L390,108 L395,110 L400,112 L405,110 L410,108 L415,112 L418,115 L420,118 L425,115 L428,112 L432,115 L435,118 L440,122 L445,125 L442,128 L438,132 L432,135 L428,138 L425,142 L420,145 L415,148 L410,145 L405,142 L400,138 L395,135 L390,132 L385,128 L380,125 L375,122 L370,118 L365,115 L362,110 L360,105 Z
M410,130 L415,128 L420,125 L425,128 L430,132 L435,135 L440,138 L445,140 L450,142 L455,145 L458,148 L460,152 L462,158 L465,165 L462,172 L458,178 L455,185 L452,192 L448,198 L445,205 L442,212 L438,220 L435,228 L430,235 L425,240 L420,245 L415,248 L410,245 L408,240 L405,232 L402,222 L400,212 L398,202 L400,192 L402,182 L405,172 L408,162 L410,152 L408,142 Z
M460,78 L468,72 L475,68 L485,65 L495,62 L505,60 L515,58 L525,60 L535,62 L545,65 L555,68 L565,72 L575,78 L582,82 L588,88 L595,92 L600,98 L608,105 L615,110 L620,115 L625,120 L630,125 L635,130 L640,135 L645,140 L642,148 L638,155 L632,160 L625,162 L618,165 L610,168 L602,170 L595,172 L588,175 L580,172 L572,170 L565,168 L558,165 L550,162 L542,158 L535,155 L528,152 L520,148 L512,145 L505,140 L498,135 L490,128 L485,122 L478,115 L472,108 L468,100 L462,92 L460,85 Z
M600,178 L608,175 L615,178 L622,182 L628,188 L632,195 L635,202 L632,210 L628,215 L622,218 L615,220 L608,218 L602,212 L598,205 L595,198 L598,190 L600,185 Z
M650,275 L658,268 L668,265 L678,262 L688,265 L698,270 L705,278 L708,288 L705,298 L698,308 L690,315 L680,318 L670,320 L660,316 L652,308 L648,298 L645,288 L648,280 Z
`;

export default function SwiftBirdsMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const birdsRef = useRef<Bird[]>([createBird(0), createBird(1), createBird(2), createBird(3)]);
  const frameRef = useRef<number>(0);
  const mapPathRef = useRef<Path2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
      // Swift bird silhouette
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.quadraticCurveTo(size * 0.5, -size * 0.08, -size * 0.3, 0);
      ctx.quadraticCurveTo(size * 0.5, size * 0.08, size, 0);
      // Left wing
      ctx.moveTo(size * 0.3, -size * 0.05);
      ctx.quadraticCurveTo(-size * 0.1, -size * 0.7, -size * 0.55, -size * 0.3);
      ctx.lineTo(-size * 0.15, -size * 0.05);
      // Right wing
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
      const sx = w / 800;
      const sy = h / 400;

      ctx.clearRect(0, 0, w, h);

      // Draw world map
      ctx.save();
      ctx.scale(sx, sy);
      if (mapPathRef.current) {
        ctx.fillStyle = 'hsla(355, 82%, 56%, 0.04)';
        ctx.fill(mapPathRef.current);
        ctx.strokeStyle = 'hsla(355, 82%, 56%, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke(mapPathRef.current);
      }

      // City dots
      CITIES.forEach((city) => {
        ctx.beginPath();
        ctx.arc(city.x, city.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(355, 82%, 56%, 0.5)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(city.x, city.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'hsla(355, 82%, 56%, 0.15)';
        ctx.lineWidth = 0.6;
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
        const cpy = Math.min(by, ey) - 60 * sy;

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
        ctx.save();
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
        ctx.restore();

        drawBird(x, y, angle, 14 * Math.min(sx, sy));
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
