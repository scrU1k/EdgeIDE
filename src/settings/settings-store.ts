export interface AppSettings {
  accentColor: string;
  fontFamily: string;
  fontSize: number;
  themeMode: 'dark' | 'light';
  viewMode: 'mobile' | 'desktop';
  codeTheme: 'oled-dark' | 'midnight' | 'dracula' | 'monokai' | 'light-clean';
}

export const ACCENT_COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Fuchsia', value: '#d946ef' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Sky Blue', value: '#0284c7' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Coral', value: '#fb7185' }
];

export const FONT_FAMILIES = [
  { name: 'Fira Code', value: "'Fira Code', monospace" },
  { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { name: 'Source Code Pro', value: "'Source Code Pro', monospace" },
  { name: 'Space Mono', value: "'Space Mono', monospace" },
  { name: 'Roboto Mono', value: "'Roboto Mono', monospace" },
  { name: 'Monospace (System)', value: 'monospace' }
];

export const SUPPORTED_FORMATS = [
  { ext: '.py', name: 'Python', engine: 'Pyodide WASM (CPython 3.12)', run: true },
  { ext: '.js / .mjs', name: 'JavaScript', engine: 'Browser Native Engine', run: true },
  { ext: '.ts', name: 'TypeScript', engine: 'Browser Native Engine', run: true },
  { ext: '.html', name: 'HTML5', engine: 'Sandboxed Live Web Preview', run: true },
  { ext: '.css', name: 'CSS3', engine: 'Sandboxed Live Web Preview', run: true },
  { ext: '.cpp / .c', name: 'C / C++', engine: 'Clang/WASI syntax highlighter', run: false },
  { ext: '.json', name: 'JSON', engine: 'Validator & Highlighter', run: false },
  { ext: '.md', name: 'Markdown', engine: 'Syntax Highlighter', run: false },
  { ext: '.rs', name: 'Rust', engine: 'Syntax Highlighter', run: false },
  { ext: '.java', name: 'Java', engine: 'Syntax Highlighter', run: false },
  { ext: '.php', name: 'PHP', engine: 'Syntax Highlighter', run: false }
];

const SETTINGS_KEY = 'edge_ide_settings_v4';

export class SettingsStore {
  private settings: AppSettings;
  private listeners: Array<(s: AppSettings) => void> = [];

  constructor() {
    this.settings = this.load();
    this.applyToDOM();
  }

  private load(): AppSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        return { ...this.defaultSettings(), ...JSON.parse(raw) };
      }
    } catch {}
    return this.defaultSettings();
  }

  private defaultSettings(): AppSettings {
    return {
      accentColor: '#6366f1',
      fontFamily: "'Fira Code', monospace",
      fontSize: 14.5,
      themeMode: 'dark',
      viewMode: 'mobile',
      codeTheme: 'oled-dark'
    };
  }

  public get(): AppSettings {
    return this.settings;
  }

  public set(partial: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...partial };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    this.applyToDOM();
    for (const fn of this.listeners) {
      fn(this.settings);
    }
  }

  public subscribe(fn: (s: AppSettings) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  public toggleTheme(): void {
    const nextMode = this.settings.themeMode === 'dark' ? 'light' : 'dark';
    const nextCodeTheme = nextMode === 'light' ? 'light-clean' : 'oled-dark';
    this.set({ 
      themeMode: nextMode,
      codeTheme: nextCodeTheme
    });
  }

  public toggleViewMode(): void {
    this.set({ viewMode: this.settings.viewMode === 'mobile' ? 'desktop' : 'mobile' });
  }

  private hexToRgba(hex: string, alpha: number): string {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) || 99;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 102;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 241;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private applyToDOM(): void {
    const root = document.documentElement;
    const accent = this.settings.accentColor;
    
    // Set dynamic CSS variables for accent color everywhere
    root.style.setProperty('--accent-color', accent);
    root.style.setProperty('--accent-color-glow', this.hexToRgba(accent, 0.4));
    root.style.setProperty('--accent-color-subtle', this.hexToRgba(accent, 0.15));
    root.style.setProperty('--accent-color-hover', this.hexToRgba(accent, 0.85));
    root.style.setProperty('--editor-font-size', `${this.settings.fontSize}px`);
    root.style.setProperty('--editor-font-family', this.settings.fontFamily);
    
    if (this.settings.themeMode === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }

    if (this.settings.viewMode === 'desktop') {
      document.body.classList.add('desktop-mode');
    } else {
      document.body.classList.remove('desktop-mode');
    }
  }
}
