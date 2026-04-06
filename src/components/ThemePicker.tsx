import { useState, useEffect } from 'react';
import { Palette, X } from 'lucide-react';

interface ThemeConfig {
  name: string;
  label: string;
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
    input: string;
    ring: string;
  };
  preview: string[]; // 3 preview colors
}

const THEMES: ThemeConfig[] = [
  {
    name: 'classic',
    label: 'Classic',
    preview: ['hsl(0,0%,100%)', 'hsl(355,82%,56%)', 'hsl(0,0%,8%)'],
    colors: {
      background: '0 0% 100%',
      foreground: '0 0% 8%',
      card: '0 0% 100%',
      cardForeground: '0 0% 8%',
      primary: '355 82% 56%',
      primaryForeground: '0 0% 100%',
      secondary: '0 0% 96%',
      secondaryForeground: '0 0% 8%',
      muted: '0 0% 95%',
      mutedForeground: '0 0% 40%',
      accent: '355 82% 56%',
      accentForeground: '0 0% 100%',
      border: '0 0% 90%',
      input: '0 0% 90%',
      ring: '355 82% 56%',
    },
  },
  {
    name: 'ocean',
    label: 'Ocean',
    preview: ['hsl(210,40%,98%)', 'hsl(210,100%,50%)', 'hsl(210,20%,15%)'],
    colors: {
      background: '210 40% 98%',
      foreground: '210 20% 15%',
      card: '210 40% 98%',
      cardForeground: '210 20% 15%',
      primary: '210 100% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '210 30% 94%',
      secondaryForeground: '210 20% 15%',
      muted: '210 30% 93%',
      mutedForeground: '210 15% 45%',
      accent: '210 100% 50%',
      accentForeground: '0 0% 100%',
      border: '210 25% 88%',
      input: '210 25% 88%',
      ring: '210 100% 50%',
    },
  },
  {
    name: 'midnight',
    label: 'Midnight',
    preview: ['hsl(220,20%,10%)', 'hsl(190,90%,55%)', 'hsl(0,0%,95%)'],
    colors: {
      background: '220 20% 10%',
      foreground: '0 0% 95%',
      card: '220 18% 13%',
      cardForeground: '0 0% 95%',
      primary: '190 90% 55%',
      primaryForeground: '220 20% 10%',
      secondary: '220 15% 18%',
      secondaryForeground: '0 0% 90%',
      muted: '220 15% 16%',
      mutedForeground: '220 10% 55%',
      accent: '190 90% 55%',
      accentForeground: '220 20% 10%',
      border: '220 15% 20%',
      input: '220 15% 20%',
      ring: '190 90% 55%',
    },
  },
  {
    name: 'forest',
    label: 'Forest',
    preview: ['hsl(140,20%,98%)', 'hsl(152,70%,40%)', 'hsl(150,20%,12%)'],
    colors: {
      background: '140 20% 98%',
      foreground: '150 20% 12%',
      card: '140 20% 98%',
      cardForeground: '150 20% 12%',
      primary: '152 70% 40%',
      primaryForeground: '0 0% 100%',
      secondary: '140 20% 94%',
      secondaryForeground: '150 20% 12%',
      muted: '140 15% 93%',
      mutedForeground: '150 10% 42%',
      accent: '152 70% 40%',
      accentForeground: '0 0% 100%',
      border: '140 15% 88%',
      input: '140 15% 88%',
      ring: '152 70% 40%',
    },
  },
  {
    name: 'sunset',
    label: 'Sunset',
    preview: ['hsl(30,30%,98%)', 'hsl(25,95%,55%)', 'hsl(20,20%,12%)'],
    colors: {
      background: '30 30% 98%',
      foreground: '20 20% 12%',
      card: '30 30% 98%',
      cardForeground: '20 20% 12%',
      primary: '25 95% 55%',
      primaryForeground: '0 0% 100%',
      secondary: '30 25% 94%',
      secondaryForeground: '20 20% 12%',
      muted: '30 20% 93%',
      mutedForeground: '20 10% 42%',
      accent: '25 95% 55%',
      accentForeground: '0 0% 100%',
      border: '30 20% 88%',
      input: '30 20% 88%',
      ring: '25 95% 55%',
    },
  },
  {
    name: 'lavender',
    label: 'Lavender',
    preview: ['hsl(270,30%,98%)', 'hsl(270,70%,60%)', 'hsl(270,20%,12%)'],
    colors: {
      background: '270 30% 98%',
      foreground: '270 20% 12%',
      card: '270 30% 98%',
      cardForeground: '270 20% 12%',
      primary: '270 70% 60%',
      primaryForeground: '0 0% 100%',
      secondary: '270 25% 94%',
      secondaryForeground: '270 20% 12%',
      muted: '270 20% 93%',
      mutedForeground: '270 10% 45%',
      accent: '270 70% 60%',
      accentForeground: '0 0% 100%',
      border: '270 20% 88%',
      input: '270 20% 88%',
      ring: '270 70% 60%',
    },
  },
];

const THEME_KEY = 'swift-theme';

function applyTheme(theme: ThemeConfig) {
  const root = document.documentElement;
  root.style.setProperty('--background', theme.colors.background);
  root.style.setProperty('--foreground', theme.colors.foreground);
  root.style.setProperty('--card', theme.colors.card);
  root.style.setProperty('--card-foreground', theme.colors.cardForeground);
  root.style.setProperty('--primary', theme.colors.primary);
  root.style.setProperty('--primary-foreground', theme.colors.primaryForeground);
  root.style.setProperty('--secondary', theme.colors.secondary);
  root.style.setProperty('--secondary-foreground', theme.colors.secondaryForeground);
  root.style.setProperty('--muted', theme.colors.muted);
  root.style.setProperty('--muted-foreground', theme.colors.mutedForeground);
  root.style.setProperty('--accent', theme.colors.accent);
  root.style.setProperty('--accent-foreground', theme.colors.accentForeground);
  root.style.setProperty('--border', theme.colors.border);
  root.style.setProperty('--input', theme.colors.input);
  root.style.setProperty('--ring', theme.colors.ring);
  root.style.setProperty('--volts-red', theme.colors.primary);
  root.style.setProperty('--volts-red-dark', theme.colors.primary);
  root.style.setProperty('--volts-red-light', theme.colors.secondary);
}

export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState('classic');

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) || 'classic';
    setActiveTheme(saved);
    const theme = THEMES.find((t) => t.name === saved) || THEMES[0];
    applyTheme(theme);
  }, []);

  const handleSelect = (theme: ThemeConfig) => {
    setActiveTheme(theme.name);
    localStorage.setItem(THEME_KEY, theme.name);
    applyTheme(theme);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 bg-card border border-border rounded-xl shadow-lg p-3 w-48 animate-fade-up">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">Theme</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((theme) => (
              <button
                key={theme.name}
                onClick={() => handleSelect(theme)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTheme === theme.name
                    ? 'bg-primary/10 ring-1 ring-primary'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex -space-x-0.5">
                  {theme.preview.map((color, i) => (
                    <div
                      key={i}
                      className="h-3.5 w-3.5 rounded-full border border-border/50"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="text-foreground truncate">{theme.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="h-10 w-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center hover:bg-muted transition-colors"
      >
        <Palette className="h-4.5 w-4.5 text-foreground" />
      </button>
    </div>
  );
}
