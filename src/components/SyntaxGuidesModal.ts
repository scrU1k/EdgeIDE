export type GuideTab = 'markdown' | 'katex' | 'mermaid';

export class SyntaxGuidesModal {
  private container: HTMLElement;
  private activeTab: GuideTab = 'markdown';

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md hidden select-none';
    parent.appendChild(this.container);
  }

  public open(defaultTab: GuideTab = 'markdown'): void {
    this.activeTab = defaultTab;
    this.container.classList.remove('hidden');
    this.render();
  }

  public close(): void {
    this.container.classList.add('hidden');
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="bg-[#0c0c0f] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3.5 bg-[#121216] border-b border-white/10">
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h2 class="font-bold text-sm text-zinc-100">Syntax Guides</h2>
              <p class="text-[11px] text-zinc-400">Reference for Markdown, Math equations & Mermaid diagrams</p>
            </div>
          </div>
          <button id="guideCloseBtn" class="p-1.5 rounded-xl hover:bg-white/5 active:scale-95 text-zinc-400 hover:text-zinc-200 transition-all">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex items-center px-4 py-2 bg-[#09090b] border-b border-white/5 gap-2">
          <button data-tab="markdown" class="guide-tab-btn flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${this.activeTab === 'markdown' ? 'bg-[var(--accent-color-subtle)] text-[var(--accent-color)] shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}">
            Markdown [.md]
          </button>
          <button data-tab="katex" class="guide-tab-btn flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${this.activeTab === 'katex' ? 'bg-[var(--accent-color-subtle)] text-[var(--accent-color)] shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}">
            KaTeX Math [$]
          </button>
          <button data-tab="mermaid" class="guide-tab-btn flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${this.activeTab === 'mermaid' ? 'bg-[var(--accent-color-subtle)] text-[var(--accent-color)] shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}">
            Mermaid Diagrams
          </button>
        </div>

        <!-- Content Body -->
        <div class="flex-1 overflow-y-auto p-5 space-y-4 font-sans text-xs select-text">
          ${this.renderActiveContent()}
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-5 py-2.5 bg-[#09090b] border-t border-white/5 text-[11px] text-zinc-500">
          <span>Live rendering supported in the Preview tab</span>
          <button id="guideDoneBtn" class="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 font-medium active:scale-95 transition-all">
            Done
          </button>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private renderActiveContent(): string {
    if (this.activeTab === 'markdown') {
      return `
        <div class="space-y-4 text-zinc-300">
          <div class="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
            <h4 class="font-bold text-zinc-100 text-xs flex items-center justify-between">
              <span>Headings</span>
              <span class="text-[10px] text-zinc-500 font-mono"># to ######</span>
            </h4>
            <pre class="bg-black/50 p-2.5 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto"># Heading 1 (Large Document Title)
## Heading 2 (Major Section)
### Heading 3 (Subsection)</pre>
          </div>

          <div class="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
            <h4 class="font-bold text-zinc-100 text-xs flex items-center justify-between">
              <span>Interactive Task Lists</span>
              <span class="text-[10px] text-amber-400 font-mono">Clickable in EdgeIDE</span>
            </h4>
            <pre class="bg-black/50 p-2.5 rounded-lg text-amber-300 font-mono text-[11px] overflow-x-auto">- [ ] Pending task item
- [x] Completed task item</pre>
            <p class="text-[11px] text-zinc-400">In the Preview panel, clicking checkboxes directly toggles task completion and synchronizes with your markdown file!</p>
          </div>

          <div class="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
            <h4 class="font-bold text-zinc-100 text-xs">Text Styling & Quotes</h4>
            <pre class="bg-black/50 p-2.5 rounded-lg text-indigo-300 font-mono text-[11px] overflow-x-auto">**Bold Text**  or  __Bold Text__
*Italic Text*  or  _Italic Text_
~~Strikethrough~~
\`inline code identifier\`

> Blockquote callout notes
> Multi-line supporting quote</pre>
          </div>

          <div class="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
            <h4 class="font-bold text-zinc-100 text-xs">Tables & Fenced Code</h4>
            <pre class="bg-black/50 p-2.5 rounded-lg text-sky-300 font-mono text-[11px] overflow-x-auto">| Syntax      | Description | Status |
| ----------- | ----------- | ------ |
| \`func()\`     | Runs logic  | Active |

\`\`\`python
def calculate_area(radius):
    import math
    return math.pi * (radius ** 2)
\`\`\`</pre>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'katex') {
      return `
        <div class="space-y-4 text-zinc-300">
          <div class="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
            <h4 class="font-bold text-zinc-100 text-xs flex items-center justify-between">
              <span>Inline vs Block Equations</span>
              <span class="text-[10px] text-sky-400 font-mono">KaTeX Engine</span>
            </h4>
            <p class="text-[11px] text-zinc-400">Use single <code class="text-sky-300 bg-black/40 px-1 rounded">$...$</code> for inline equations and double <code class="text-sky-300 bg-black/40 px-1 rounded">$$...$$</code> for centered display equations.</p>
            <pre class="bg-black/50 p-2.5 rounded-lg text-sky-300 font-mono text-[11px] overflow-x-auto">Einstein's mass-energy equation is $E = mc^2$.

$$f(x) = \\int_{-\\infty}^{\\infty} \\hat f(\\xi)\\,e^{2 \\pi i \\xi x} \\,d\\xi$$</pre>
          </div>

          <div class="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
            <h4 class="font-bold text-zinc-100 text-xs">Fractions, Roots & Summations</h4>
            <pre class="bg-black/50 p-2.5 rounded-lg text-emerald-300 font-mono text-[11px] overflow-x-auto">$$\\frac{a + b}{c - d} \\quad \\sqrt{x^2 + y^2} \\quad \\sqrt[n]{x}$$

$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2} \\qquad \\prod_{i=1}^{n} x_i$$

$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$</pre>
          </div>

          <div class="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
            <h4 class="font-bold text-zinc-100 text-xs">Matrices & Greek Letters</h4>
            <pre class="bg-black/50 p-2.5 rounded-lg text-purple-300 font-mono text-[11px] overflow-x-auto">$$\\alpha, \\beta, \\gamma, \\theta, \\lambda, \\pi, \\sigma, \\Omega, \\Delta$$

$$A = \\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}
\\quad
\\vec{v} = \\begin{bmatrix} x \\\\ y \\\\ z \\end{bmatrix}$$</pre>
          </div>
        </div>
      `;
    }

    // Mermaid Tab
    return `
      <div class="space-y-4 text-zinc-300">
        <div class="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
          <h4 class="font-bold text-zinc-100 text-xs flex items-center justify-between">
            <span>Flowcharts</span>
            <span class="text-[10px] text-indigo-400 font-mono">graph TD / LR</span>
          </h4>
          <pre class="bg-black/50 p-2.5 rounded-lg text-indigo-300 font-mono text-[11px] overflow-x-auto">\`\`\`mermaid
graph TD
    A[Start Request] --> B{Is Authenticated?}
    B -- Yes --> C[Load User Workspace]
    B -- No --> D[Prompt Login / PIN]
    C --> E[Render Editor]
\`\`\`</pre>
        </div>

        <div class="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
          <h4 class="font-bold text-zinc-100 text-xs">Sequence Diagrams</h4>
          <pre class="bg-black/50 p-2.5 rounded-lg text-cyan-300 font-mono text-[11px] overflow-x-auto">\`\`\`mermaid
sequenceDiagram
    autonumber
    Client->>Server: POST /api/native-exec/run
    Note over Server: Spawn Python Worker
    Server-->>Client: 200 OK (stdout result)
\`\`\`</pre>
        </div>

        <div class="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
          <h4 class="font-bold text-zinc-100 text-xs">State & Class Diagrams</h4>
          <pre class="bg-black/50 p-2.5 rounded-lg text-pink-300 font-mono text-[11px] overflow-x-auto">\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Running : Run Code
    Running --> Idle : Execution Finished
    Running --> Error : Exception Thrown
\`\`\`</pre>
        </div>
      </div>
    `;
  }

  private attachEvents(): void {
    this.container.querySelector('#guideCloseBtn')?.addEventListener('click', () => this.close());
    this.container.querySelector('#guideDoneBtn')?.addEventListener('click', () => this.close());

    // Click outside to close
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.close();
      }
    });

    // Tab buttons
    this.container.querySelectorAll('.guide-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as GuideTab;
        if (tab) {
          this.activeTab = tab;
          this.render();
        }
      });
    });
  }
}
