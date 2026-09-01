import { VirtualFileSystem } from '../vfs/vfs';
import { getFileIcon, Icons } from './icons';

export interface SearchResult {
  type: 'file' | 'folder' | 'code' | 'text';
  id: string;
  name: string;
  path: string;
  language?: string;
  lineNumber?: number;
  snippet?: string;
  matchStart?: number;
  matchLength?: number;
}

export class SearchModal {
  private container: HTMLElement;
  private inputEl!: HTMLInputElement;
  private resultsContainer!: HTMLElement;
  private vfs: VirtualFileSystem;
  private onNavigate: (fileId: string, lineNumber?: number) => void;
  private selectedIndex: number = 0;
  private currentResults: SearchResult[] = [];
  private debounceTimer: any = null;

  constructor(
    parent: HTMLElement,
    vfs: VirtualFileSystem,
    onNavigate: (fileId: string, lineNumber?: number) => void
  ) {
    this.vfs = vfs;
    this.onNavigate = onNavigate;

    this.container = document.createElement('div');
    this.container.className = 'fixed inset-0 z-50 flex flex-col items-center pt-8 md:pt-16 p-3 bg-black/75 backdrop-blur-md hidden select-none';
    parent.appendChild(this.container);

    this.render();
    this.attachEvents();
  }

  public open(initialQuery: string = ''): void {
    this.container.classList.remove('hidden');
    this.inputEl.value = initialQuery;
    this.selectedIndex = 0;
    this.performSearch(initialQuery);
    setTimeout(() => {
      this.inputEl.focus();
      this.inputEl.select();
    }, 50);
  }

  public close(): void {
    this.container.classList.add('hidden');
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="search-modal-card bg-[#0c0c0f] border border-white/10 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <!-- Search Input Bar -->
        <div class="flex items-center gap-2.5 px-3.5 py-3 bg-[#121216] border-b border-white/10">
          <button id="searchBackBtn" title="Back / Close (Esc)" class="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-zinc-300 hover:text-white transition-all flex items-center justify-center shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <input 
            type="text" 
            id="workspaceSearchInput" 
            placeholder="Search files, folders, symbols, or code across workspace..." 
            class="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none font-mono"
            autocomplete="off"
            spellcheck="false"
          />
          <kbd class="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-zinc-400 bg-white/5 border border-white/10 rounded-lg">ESC</kbd>
        </div>

        <!-- Search Results List -->
        <div id="searchResultsList" class="max-h-[60vh] overflow-y-auto p-2 space-y-1 divide-y divide-white/5">
          <!-- Populated dynamically -->
        </div>

        <!-- Footer Help -->
        <div class="flex items-center justify-between px-4 py-2 bg-[#09090b] border-t border-white/5 text-[11px] text-zinc-500">
          <div class="flex items-center gap-3">
            <span><strong class="text-zinc-300">↑↓</strong> Navigate</span>
            <span><strong class="text-zinc-300">Enter</strong> Open</span>
          </div>
          <span id="searchResultCount" class="font-mono text-zinc-400">0 results</span>
        </div>
      </div>
    `;

    this.inputEl = this.container.querySelector('#workspaceSearchInput') as HTMLInputElement;
    this.resultsContainer = this.container.querySelector('#searchResultsList') as HTMLElement;
  }

  private attachEvents(): void {
    // Back button
    this.container.querySelector('#searchBackBtn')?.addEventListener('click', () => {
      this.close();
    });

    // Click outside to close
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.close();
      }
    });

    // Input changes
    this.inputEl.addEventListener('input', () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.selectedIndex = 0;
        this.performSearch(this.inputEl.value.trim());
      }, 120);
    });

    // Keydown handlers
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.currentResults.length > 0) {
          this.selectedIndex = (this.selectedIndex + 1) % this.currentResults.length;
          this.updateSelectionUI();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.currentResults.length > 0) {
          this.selectedIndex = (this.selectedIndex - 1 + this.currentResults.length) % this.currentResults.length;
          this.updateSelectionUI();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.currentResults[this.selectedIndex]) {
          this.handleSelect(this.currentResults[this.selectedIndex]);
        }
      }
    });
  }

  private performSearch(query: string): void {
    const results: SearchResult[] = [];
    const allFiles = this.vfs.getAllFiles();
    const allNodes = this.vfs.getAllNodes();

    if (!query) {
      // Show recent / all files by default
      allFiles.slice(0, 12).forEach(f => {
        results.push({
          type: 'file',
          id: f.id,
          name: f.name,
          path: f.path,
          language: f.language
        });
      });
    } else {
      const lowerQuery = query.toLowerCase();

      // 1. Match File Names
      for (const node of allNodes) {
        if (node.isDraft) continue;
        if (node.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: node.isFolder ? 'folder' : 'file',
            id: node.id,
            name: node.name,
            path: node.path,
            language: node.language
          });
        }
      }

      // 2. Match Code / Text contents across files
      for (const file of allFiles) {
        if (!file.content) continue;
        const lines = file.content.split('\n');

        for (let l = 0; l < lines.length; l++) {
          const lineText = lines[l];
          const matchIdx = lineText.toLowerCase().indexOf(lowerQuery);

          if (matchIdx !== -1) {
            const isCode = !['plaintext', 'log', 'todo'].includes(file.language);
            results.push({
              type: isCode ? 'code' : 'text',
              id: file.id,
              name: file.name,
              path: file.path,
              language: file.language,
              lineNumber: l + 1,
              snippet: lineText.trim(),
              matchStart: matchIdx,
              matchLength: query.length
            });

            if (results.length >= 40) break; // Limit result set for speed
          }
        }
        if (results.length >= 40) break;
      }
    }

    this.currentResults = results;
    this.renderResults();
  }

  private renderResults(): void {
    const countBadge = this.container.querySelector('#searchResultCount') as HTMLElement;
    if (countBadge) {
      countBadge.textContent = `${this.currentResults.length} match${this.currentResults.length === 1 ? '' : 'es'}`;
    }

    if (this.currentResults.length === 0) {
      this.resultsContainer.innerHTML = `
        <div class="py-8 text-center text-zinc-500 text-xs">
          No files, folders, or code matches found.
        </div>
      `;
      return;
    }

    this.resultsContainer.innerHTML = this.currentResults.map((item, idx) => {
      const isSelected = idx === this.selectedIndex;

      let badgeHtml = '';
      let iconHtml = '';

      if (item.type === 'folder') {
        badgeHtml = `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono">Folder</span>`;
        iconHtml = `<span>${Icons.folder}</span>`;
      } else if (item.type === 'file') {
        badgeHtml = `<span class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 font-mono">File</span>`;
        iconHtml = `<span>${getFileIcon(item.language || 'plaintext')}</span>`;
      } else if (item.type === 'code') {
        badgeHtml = `<span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 font-mono">Code (${item.language})</span>`;
        iconHtml = `<span>${getFileIcon(item.language || 'plaintext')}</span>`;
      } else {
        badgeHtml = `<span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono">Text</span>`;
        iconHtml = `<span>${getFileIcon(item.language || 'plaintext')}</span>`;
      }

      return `
        <div data-result-index="${idx}" class="search-result-item flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
          isSelected 
            ? 'bg-[var(--accent-color-subtle)] text-[var(--accent-color)] ring-1 ring-[var(--accent-color)]/30 font-medium' 
            : 'hover:bg-white/5 text-zinc-300'
        }">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="shrink-0 text-base">${iconHtml}</div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs font-semibold text-zinc-100 truncate">${item.name}</span>
                ${item.lineNumber ? `<span class="font-mono text-[11px] text-zinc-400 bg-white/5 px-1.5 rounded">Line ${item.lineNumber}</span>` : ''}
                <span class="text-[11px] text-zinc-500 truncate">${item.path}</span>
              </div>
              ${item.snippet ? `
                <div class="text-[11px] font-mono text-zinc-400 truncate mt-0.5 bg-black/30 px-2 py-0.5 rounded border border-white/5">
                  ${this.highlightMatch(item.snippet, this.inputEl.value.trim())}
                </div>
              ` : ''}
            </div>
          </div>
          <div class="shrink-0 ml-2">
            ${badgeHtml}
          </div>
        </div>
      `;
    }).join('');

    // Attach click handlers
    const resultItems = this.resultsContainer.querySelectorAll('.search-result-item');
    resultItems.forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-result-index') || '0', 10);
        if (this.currentResults[idx]) {
          this.handleSelect(this.currentResults[idx]);
        }
      });
    });

    this.updateSelectionUI();
  }

  private updateSelectionUI(): void {
    const items = this.resultsContainer.querySelectorAll('.search-result-item');
    items.forEach((item, idx) => {
      if (idx === this.selectedIndex) {
        item.classList.add('bg-[var(--accent-color-subtle)]', 'ring-1', 'ring-[var(--accent-color)]/30');
        (item as HTMLElement).scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('bg-[var(--accent-color-subtle)]', 'ring-1', 'ring-[var(--accent-color)]/30');
      }
    });
  }

  private handleSelect(item: SearchResult): void {
    this.close();
    if (item.type === 'folder') {
      const folder = this.vfs.getNode(item.id);
      if (folder) {
        folder.isExpanded = true;
        this.vfs.save();
      }
    } else {
      this.onNavigate(item.id, item.lineNumber);
    }
  }

  private highlightMatch(text: string, query: string): string {
    if (!query) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark class="bg-[var(--accent-color)]/30 text-[var(--accent-color)] rounded px-0.5 font-bold">$1</mark>');
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
