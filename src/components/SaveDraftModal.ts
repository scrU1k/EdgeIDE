import { VirtualFileSystem } from '../vfs/vfs';

export class SaveDraftModal {
  private container: HTMLElement;
  private modal: HTMLElement;
  private vfs: VirtualFileSystem;
  private currentDraftId: string | null = null;
  private onSavedCallback?: (fileId: string) => void;

  constructor(parent: HTMLElement, vfs: VirtualFileSystem, onSaved?: (fileId: string) => void) {
    this.vfs = vfs;
    this.onSavedCallback = onSaved;

    this.container = document.createElement('div');
    this.container.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm hidden select-none animate-fade-in';

    this.modal = document.createElement('div');
    this.modal.className = 'settings-modal-card bg-[#0c0c0f] border border-white/10 rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden';
    this.container.appendChild(this.modal);
    parent.appendChild(this.container);
  }

  public open(draftId: string): void {
    this.currentDraftId = draftId;
    const draft = this.vfs.getFile(draftId);
    if (!draft) return;

    let defaultName = draft.name;
    if (!defaultName.includes('.')) defaultName += '.txt';

    this.modal.innerHTML = `
      <div class="flex items-center justify-between px-5 py-4 bg-[#0c0c0f] border-b border-white/5 shrink-0">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
          </svg>
          <h2 class="font-bold text-sm text-zinc-100">Save File</h2>
        </div>
        <button id="saveDraftCloseBtn" class="p-1.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-zinc-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="p-5 space-y-4">
        <div>
          <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Filename</label>
          <input id="saveDraftInput" type="text" value="${defaultName}" placeholder="e.g. notes.txt, app.py" class="w-full px-3.5 py-2.5 bg-[#141418] border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-indigo-500 transition-colors">
          <div id="saveDraftError" class="text-[11px] text-red-400 mt-1 hidden">Please enter a valid filename.</div>
        </div>

        <!-- Quick Extension Tags -->
        <div>
          <div class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Quick Extensions</div>
          <div class="flex flex-wrap gap-1.5">
            ${['.txt', '.py', '.js', '.ts', '.md', '.html', '.css', '.json', '.cpp'].map(ext => `
              <button type="button" class="quick-ext-btn px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-zinc-300 transition-all hover:scale-105 active:scale-95" data-ext="${ext}">
                ${ext}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button id="saveDraftCancelBtn" type="button" class="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold text-xs transition-colors">
            Cancel
          </button>
          <button id="saveDraftSubmitBtn" type="button" class="flex-1 py-2.5 rounded-xl font-semibold text-xs text-white transition-all shadow-md active:scale-95" style="background-color: var(--accent-color);">
            Save to Workspace
          </button>
        </div>
      </div>
    `;

    this.container.classList.remove('hidden');

    const input = this.modal.querySelector('#saveDraftInput') as HTMLInputElement;
    if (input) {
      setTimeout(() => {
        input.focus();
        const dotIndex = input.value.lastIndexOf('.');
        if (dotIndex > 0) {
          input.setSelectionRange(0, dotIndex);
        } else {
          input.select();
        }
      }, 50);
    }

    this.attachEvents();
  }

  public close(): void {
    this.container.classList.add('hidden');
    this.currentDraftId = null;
  }

  private attachEvents(): void {
    const input = this.modal.querySelector('#saveDraftInput') as HTMLInputElement;
    const errorEl = this.modal.querySelector('#saveDraftError');

    this.modal.querySelector('#saveDraftCloseBtn')?.addEventListener('click', () => this.close());
    this.modal.querySelector('#saveDraftCancelBtn')?.addEventListener('click', () => this.close());

    // Quick extension button click
    this.modal.querySelectorAll('.quick-ext-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ext = btn.getAttribute('data-ext');
        if (!ext || !input) return;
        const currentVal = input.value.trim();
        const base = currentVal.includes('.') ? currentVal.substring(0, currentVal.lastIndexOf('.')) : currentVal;
        input.value = (base || 'Untitled') + ext;
        input.focus();
      });
    });

    const submit = () => {
      if (!this.currentDraftId) return;
      const val = input.value.trim();
      if (!val) {
        errorEl?.classList.remove('hidden');
        return;
      }

      const savedNode = this.vfs.saveDraft(this.currentDraftId, val);
      if (savedNode) {
        this.close();
        if (this.onSavedCallback) {
          this.onSavedCallback(savedNode.id);
        }
      }
    };

    this.modal.querySelector('#saveDraftSubmitBtn')?.addEventListener('click', submit);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });
  }
}
