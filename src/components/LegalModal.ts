export class LegalModal {
  private container: HTMLElement;
  private activeTab: 'privacy' | 'terms' = 'privacy';

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md hidden select-none';
    parent.appendChild(this.container);
  }

  public open(tab: 'privacy' | 'terms' = 'privacy'): void {
    this.activeTab = tab;
    this.container.classList.remove('hidden');
    this.render();
  }

  public close(): void {
    this.container.classList.add('hidden');
  }

  public isOpen(): boolean {
    return !this.container.classList.contains('hidden');
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="bg-[#0c0c0f] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3.5 bg-[#121216] border-b border-white/10">
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 class="font-bold text-sm text-zinc-100">Privacy & Terms</h2>
              <p class="text-[11px] text-zinc-400">Open source governance, rights & privacy disclosures</p>
            </div>
          </div>
          <button id="legalCloseBtn" class="p-1.5 rounded-xl hover:bg-white/5 active:scale-95 text-zinc-400 hover:text-zinc-200 transition-all">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex items-center px-4 py-2 bg-[#09090b] border-b border-white/5 gap-2">
          <button id="tabPrivacyBtn" class="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
            this.activeTab === 'privacy' 
              ? 'bg-[var(--accent-color-subtle)] text-[var(--accent-color)] shadow-sm' 
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }">
            Privacy Policy
          </button>
          <button id="tabTermsBtn" class="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
            this.activeTab === 'terms' 
              ? 'bg-[var(--accent-color-subtle)] text-[var(--accent-color)] shadow-sm' 
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }">
            Terms of Service (GPL v3)
          </button>
        </div>

        <!-- Content Body (Scrollable) -->
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs text-zinc-300 leading-relaxed select-text font-sans">
          ${this.activeTab === 'privacy' ? this.renderPrivacyHtml() : this.renderTermsHtml()}
        </div>

        <!-- Footer -->
        <div class="px-5 py-2.5 bg-[#09090c] border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-500 shrink-0 select-none">
          <span>EdgeIDE Open Source</span>
          <button id="legalDoneBtn" class="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-200 font-semibold text-xs active:scale-95 transition-all">
            Done
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#legalCloseBtn')?.addEventListener('click', () => this.close());
    this.container.querySelector('#legalDoneBtn')?.addEventListener('click', () => this.close());

    this.container.querySelector('#tabPrivacyBtn')?.addEventListener('click', () => {
      this.activeTab = 'privacy';
      this.render();
    });

    this.container.querySelector('#tabTermsBtn')?.addEventListener('click', () => {
      this.activeTab = 'terms';
      this.render();
    });

    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.close();
      }
    });
  }

  private renderPrivacyHtml(): string {
    return `
      <div class="space-y-3">
        <div class="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
          <div class="font-semibold text-indigo-300 text-xs mb-1">Offline-First & Zero Tracking</div>
          <div class="text-zinc-400 text-[11px]">The application is designed without tracking analytics, telemetry, or advertising frameworks. All code evaluation occurs directly on your client hardware.</div>
        </div>

        <div>
          <h3 class="font-bold text-zinc-100 text-xs mb-1">1. Local Data Storage & Control</h3>
          <p class="text-zinc-400">All project files, notebooks, and configurations are stored in IndexedDB and the local device document folder (<code class="text-zinc-300 bg-white/5 px-1 rounded">Documents/EdgeIDE</code>). You maintain complete ownership. Clearing app data or deleting files removes all stored content with zero cloud residues.</p>
        </div>

        <div>
          <h3 class="font-bold text-zinc-100 text-xs mb-1">2. Local Wi-Fi & Portable Hotspot Bridging</h3>
          <p class="text-zinc-400">Peer-to-peer workspace sharing operates directly across local Wi-Fi or temporary portable Wi-Fi hotspots without requiring internet access. Packets travel strictly between the two devices across the local subnet.</p>
        </div>

        <div>
          <h3 class="font-bold text-zinc-100 text-xs mb-1">3. End-to-End Encryption (E2EE)</h3>
          <p class="text-zinc-400">All direct messages and transferred project files are encrypted end-to-end using ECDH P-256 key agreement and authenticated AES-GCM 256-bit encryption with a unique 12-byte IV per message. Key pinning is enforced to prevent tampering.</p>
        </div>

        <div>
          <h3 class="font-bold text-zinc-100 text-xs mb-1">4. Optical QR Code Discovery</h3>
          <p class="text-zinc-400">Camera permission is used solely in volatile memory for scanning QR codes during offline discovery and key exchange. No video or biometric data is ever saved or transmitted.</p>
        </div>

        <div>
          <h3 class="font-bold text-zinc-100 text-xs mb-1">5. Offline Isolation Toggle ("Net: Off")</h3>
          <p class="text-zinc-400">The in-app "Net: Off" toggle severs all external internet relays, blocks sandbox outbound network calls, and confines all operations to the offline client hardware.</p>
        </div>
      </div>
    `;
  }

  private renderTermsHtml(): string {
    return `
      <div class="space-y-3">
        <div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <div class="font-semibold text-emerald-300 text-xs mb-1">GNU General Public License v3 (GPL v3)</div>
          <div class="text-zinc-400 text-[11px]">EdgeIDE is free, open-source software. Your rights to run, study, modify, and redistribute the application are governed by the GPL v3 license.</div>
        </div>

        <div>
          <h3 class="font-bold text-zinc-100 text-xs mb-1">1. Acceptance & Rights</h3>
          <p class="text-zinc-400">In accordance with Section 9 of the GPL v3, you are not required to accept the license merely to run the application. Acceptance is only required if you modify or redistribute the software.</p>
        </div>

        <div>
          <h3 class="font-bold text-zinc-100 text-xs mb-1">2. User Responsibility & Ethical Scope</h3>
          <p class="text-zinc-400">The application serves as a developer productivity and educational tool. The user maintains sole responsibility for all source code, scripts, configurations, and commands executed. EdgeIDE is not designed for, and the project does not endorse, malicious use or unauthorized network actions.</p>
        </div>

        <div>
          <h3 class="font-bold text-zinc-100 text-xs mb-1">3. Disclaimer of Warranties</h3>
          <p class="text-zinc-400 font-mono text-[11px] bg-black/40 p-2 rounded-lg border border-white/5">IN ACCORDANCE WITH SECTIONS 15 AND 16 OF THE GPL V3, THE PROGRAM IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED.</p>
        </div>

        <div>
          <h3 class="font-bold text-zinc-100 text-xs mb-1">4. Limitation of Liability</h3>
          <p class="text-zinc-400">To the maximum extent permitted by applicable law and the GPL v3, the author and contributors bear no liability for any loss of data, corrupted storage, or damages resulting from the use or inability to use the program.</p>
        </div>

        <div>
          <h3 class="font-bold text-zinc-100 text-xs mb-1">5. Severability</h3>
          <p class="text-zinc-400">If any provision of these Terms is held to be invalid or unenforceable, that provision shall be enforced to the maximum extent permissible, and the remaining provisions shall remain in full force and effect.</p>
        </div>
      </div>
    `;
  }
}
