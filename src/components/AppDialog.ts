export interface PromptOptions {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export class AppDialog {
  private static container: HTMLElement | null = null;

  private static ensureContainer(): HTMLElement {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'appDialogContainer';
      this.container.className = 'fixed inset-0 z-70 flex items-center justify-center p-4 select-none';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  public static prompt(options: PromptOptions): Promise<string | null> {
    return new Promise((resolve) => {
      const container = this.ensureContainer();
      container.classList.remove('hidden');

      container.innerHTML = `
        <div class="dialog-backdrop absolute inset-0 bg-black/70 transition-opacity duration-150"></div>
        <div class="dialog-card relative w-full max-w-xs bg-[#121216] border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4 transform scale-95 opacity-0 transition-all duration-150">
          <div class="flex items-center gap-2">
            ${options.icon ? `<span>${options.icon}</span>` : ''}
            <h3 class="font-bold text-sm text-zinc-100">${options.title}</h3>
          </div>

          <div>
            <input 
              id="dialogInput" 
              type="text" 
              value="${options.defaultValue || ''}" 
              placeholder="${options.placeholder || ''}" 
              class="w-full px-3 py-2 bg-[#1a1a20] border border-white/10 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-1">
            <button id="dialogCancelBtn" class="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-all">
              ${options.cancelText || 'Cancel'}
            </button>
            <button id="dialogConfirmBtn" style="background-color: var(--accent-color);" class="px-4 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all">
              ${options.confirmText || 'Confirm'}
            </button>
          </div>
        </div>
      `;

      const card = container.querySelector('.dialog-card') as HTMLElement;
      const input = container.querySelector('#dialogInput') as HTMLInputElement;
      const confirmBtn = container.querySelector('#dialogConfirmBtn') as HTMLButtonElement;
      const cancelBtn = container.querySelector('#dialogCancelBtn') as HTMLButtonElement;
      const backdrop = container.querySelector('.dialog-backdrop') as HTMLElement;

      void card.offsetWidth;
      card.classList.remove('scale-95', 'opacity-0');
      card.classList.add('scale-100', 'opacity-100');

      input.focus();
      input.select();

      const cleanup = (result: string | null) => {
        card.classList.remove('scale-100', 'opacity-100');
        card.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
          container.classList.add('hidden');
          container.innerHTML = '';
          resolve(result);
        }, 150);
      };

      confirmBtn.addEventListener('click', () => {
        cleanup(input.value.trim() || null);
      });

      cancelBtn.addEventListener('click', () => {
        cleanup(null);
      });

      backdrop.addEventListener('click', () => {
        cleanup(null);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          cleanup(input.value.trim() || null);
        } else if (e.key === 'Escape') {
          cleanup(null);
        }
      });
    });
  }

  public static confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const container = this.ensureContainer();
      container.classList.remove('hidden');

      container.innerHTML = `
        <div class="dialog-backdrop absolute inset-0 bg-black/70 transition-opacity duration-150"></div>
        <div class="dialog-card relative w-full max-w-xs bg-[#121216] border border-white/10 rounded-2xl shadow-2xl p-5 space-y-3 transform scale-95 opacity-0 transition-all duration-150">
          <h3 class="font-bold text-sm text-zinc-100">${options.title}</h3>
          <p class="text-xs text-zinc-400 leading-relaxed">${options.message}</p>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button id="dialogCancelBtn" class="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-all">
              ${options.cancelText || 'Cancel'}
            </button>
            <button id="dialogConfirmBtn" class="px-4 py-1.5 rounded-xl text-xs font-semibold ${options.isDestructive ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500'} text-white shadow-sm active:scale-95 transition-all">
              ${options.confirmText || 'OK'}
            </button>
          </div>
        </div>
      `;

      const card = container.querySelector('.dialog-card') as HTMLElement;
      const confirmBtn = container.querySelector('#dialogConfirmBtn') as HTMLButtonElement;
      const cancelBtn = container.querySelector('#dialogCancelBtn') as HTMLButtonElement;
      const backdrop = container.querySelector('.dialog-backdrop') as HTMLElement;

      void card.offsetWidth;
      card.classList.remove('scale-95', 'opacity-0');
      card.classList.add('scale-100', 'opacity-100');

      const cleanup = (result: boolean) => {
        card.classList.remove('scale-100', 'opacity-100');
        card.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
          container.classList.add('hidden');
          container.innerHTML = '';
          resolve(result);
        }, 150);
      };

      confirmBtn.addEventListener('click', () => cleanup(true));
      cancelBtn.addEventListener('click', () => cleanup(false));
      backdrop.addEventListener('click', () => cleanup(false));
    });
  }
}
