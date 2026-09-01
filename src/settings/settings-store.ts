export type SharingVisibility = 'everyone' | 'trusted' | 'offline';

export interface TrustedDevice {
  id: string;
  name: string;
  platform: string;
  addedAt: number;
  lastSeen: number;
}

export interface AppSettings {
  accentColor: string;
  fontFamily: string;
  fontSize: number;
  themeMode: 'dark' | 'light';
  viewMode: 'mobile' | 'desktop';
  codeTheme: 'oled-dark' | 'midnight' | 'dracula' | 'monokai' | 'light-clean';
  wordWrap: boolean;
  showLineNumbers: boolean;
  // Sharing & Sync Configuration
  sharingVisibility: SharingVisibility;
  deviceName: string;
  deviceId: string;
  trustedDevices: TrustedDevice[];
  dismissedTrustedDeviceIds: string[];
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

export interface FormatItem {
  ext: string;
  name: string;
  engine: string;
  badge: 'Runnable' | 'Live Preview' | 'Syntax' | 'Personal Dict' | 'Validator';
}

export interface FormatCategory {
  id: string;
  title: string;
  description: string;
  formats: FormatItem[];
}

export const FORMAT_CATEGORIES: FormatCategory[] = [
  {
    id: 'programming',
    title: 'Programming & Scripting',
    description: 'General purpose code, scripting, mobile & systems languages',
    formats: [
      { ext: '.py', name: 'Python 3.12', engine: 'Pyodide WASM + pip packages', badge: 'Runnable' },
      { ext: '.js / .mjs', name: 'JavaScript', engine: 'Browser Native V8 Engine', badge: 'Runnable' },
      { ext: '.ts', name: 'TypeScript', engine: 'Browser Engine & Type Linter', badge: 'Runnable' },
      { ext: '.jsx / .tsx', name: 'React / Vite Sandbox', engine: 'Interactive Component Live Preview', badge: 'Live Preview' },
      { ext: '.rb / .erb', name: 'Ruby', engine: 'Syntax Highlighter & Snippets', badge: 'Syntax' },
      { ext: '.swift', name: 'Swift', engine: 'Syntax Highlighter & SwiftUI Snippets', badge: 'Syntax' },
      { ext: '.go', name: 'Go (Golang)', engine: 'Syntax Highlighter & Snippets', badge: 'Syntax' },
      { ext: '.jl', name: 'Julia', engine: 'Syntax Highlighter & Math Snippets', badge: 'Syntax' },
      { ext: '.kt / .kts', name: 'Kotlin', engine: 'Syntax Highlighter & Android Snippets', badge: 'Syntax' },
      { ext: '.ps1', name: 'PowerShell', engine: 'Script Syntax & Command Highlighter', badge: 'Syntax' },
      { ext: '.r / .rmd', name: 'R / RMarkdown', engine: 'Data & Statistics Syntax Highlighter', badge: 'Syntax' },
      { ext: '.cpp / .c', name: 'C / C++', engine: 'Clang/WASI Syntax Highlighter', badge: 'Syntax' },
      { ext: '.rs', name: 'Rust', engine: 'Syntax Highlighter & Snippets', badge: 'Syntax' },
      { ext: '.java', name: 'Java', engine: 'Syntax Highlighter & Snippets', badge: 'Syntax' },
      { ext: '.php', name: 'PHP', engine: 'Syntax Highlighter & Snippets', badge: 'Syntax' }
    ]
  },
  {
    id: 'web',
    title: 'Web & Frontend Development',
    description: 'HTML5, CSS3 stylesheets and structured data',
    formats: [
      { ext: '.html', name: 'HTML5', engine: 'Sandboxed Live Web Sandbox', badge: 'Live Preview' },
      { ext: '.css', name: 'CSS3', engine: 'Sandboxed Live Web Sandbox', badge: 'Live Preview' },
      { ext: '.json', name: 'JSON', engine: 'Formatter, Schema Validator & Linter', badge: 'Validator' }
    ]
  },
  {
    id: 'database',
    title: 'Database & Queries',
    description: 'Relational data, query scripts and table schemas',
    formats: [
      { ext: '.sql', name: 'SQL / SQLite', engine: 'ANSI SQL & SQLite Query Syntax Highlighter', badge: 'Syntax' }
    ]
  },
  {
    id: 'notes',
    title: 'Notes, Documents & Outlines',
    description: 'Dedicated personal learned dictionary & interactive task sync',
    formats: [
      { ext: '.md', name: 'Markdown', engine: 'Interactive Checklist Live Sync & Preview', badge: 'Live Preview' },
      { ext: '.txt', name: 'Plain Text', engine: 'Scratchpad & Personal Learned Dict', badge: 'Personal Dict' },
      { ext: '.org', name: 'Org-Mode', engine: 'Outlines, Headings & Personal Learned Dict', badge: 'Personal Dict' },
      { ext: '.rst', name: 'reStructuredText', engine: 'Technical Docs & Personal Learned Dict', badge: 'Personal Dict' },
      { ext: '.adoc', name: 'AsciiDoc', engine: 'Drafts, Articles & Personal Learned Dict', badge: 'Personal Dict' },
      { ext: '.log', name: 'Devlog / Journal', engine: 'Daily Logs, Changelogs & Personal Dict', badge: 'Personal Dict' },
      { ext: '.todo', name: 'Task Checklist', engine: 'Plain Text Task Lists & Personal Dict', badge: 'Personal Dict' }
    ]
  }
];

export const SUPPORTED_FORMATS = FORMAT_CATEGORIES.flatMap(cat => 
  cat.formats.map(f => ({
    ext: f.ext,
    name: f.name,
    engine: f.engine,
    run: f.badge === 'Runnable' || f.badge === 'Live Preview'
  }))
);

const SETTINGS_KEY = 'edge_ide_settings_v6';

function generateRandomDeviceId(): string {
  const chars = '0123456789abcdef';
  let id = 'dev_';
  for (let i = 0; i < 10; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function getDefaultDeviceName(): string {
  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isMac = /macintosh/i.test(navigator.userAgent);
  const isWindows = /windows/i.test(navigator.userAgent);
  
  if (isAndroid) return 'Android IDE Device';
  if (isIOS) return 'iOS IDE Device';
  if (isMac) return 'Mac IDE Workstation';
  if (isWindows) return 'Windows IDE PC';
  return 'EdgeIDE Device';
}

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
        const parsed = JSON.parse(raw);
        return { ...this.defaultSettings(), ...parsed };
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
      codeTheme: 'oled-dark',
      wordWrap: false,
      showLineNumbers: true,
      sharingVisibility: 'everyone',
      deviceName: getDefaultDeviceName(),
      deviceId: generateRandomDeviceId(),
      trustedDevices: [],
      dismissedTrustedDeviceIds: []
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
    this.set({ 
      themeMode: nextMode
    });
  }

  public toggleViewMode(): void {
    this.set({ viewMode: this.settings.viewMode === 'mobile' ? 'desktop' : 'mobile' });
  }

  // Trusted Devices Management
  public addTrustedDevice(device: Omit<TrustedDevice, 'addedAt'>): void {
    const existing = this.settings.trustedDevices.filter(d => d.id !== device.id);
    const newEntry: TrustedDevice = {
      ...device,
      addedAt: Date.now()
    };
    this.set({
      trustedDevices: [...existing, newEntry]
    });
  }

  public removeTrustedDevice(deviceId: string): void {
    this.set({
      trustedDevices: this.settings.trustedDevices.filter(d => d.id !== deviceId)
    });
  }

  public isTrusted(deviceId: string): boolean {
    return this.settings.trustedDevices.some(d => d.id === deviceId);
  }

  public dismissTrustPrompt(deviceId: string): void {
    if (!this.settings.dismissedTrustedDeviceIds.includes(deviceId)) {
      this.set({
        dismissedTrustedDeviceIds: [...this.settings.dismissedTrustedDeviceIds, deviceId]
      });
    }
  }

  public isTrustDismissed(deviceId: string): boolean {
    return this.settings.dismissedTrustedDeviceIds.includes(deviceId);
  }

  public resetVisualSettings(): void {
    // Only resets visual and editor customizations; preserves device ID, trusted devices, sharing visibility, and device name
    this.set({
      accentColor: '#6366f1',
      fontFamily: "'Fira Code', monospace",
      fontSize: 14.5,
      themeMode: 'dark',
      codeTheme: 'oled-dark',
      wordWrap: false,
      showLineNumbers: true
    });
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
    
    root.setAttribute('data-theme', this.settings.themeMode);

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
