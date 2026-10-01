import { VirtualFileSystem } from '../vfs/vfs';
import { VirtualNode } from '../vfs/types';

export class HtmlPreviewBuilder {
  public static buildBundle(vfs: VirtualFileSystem, targetFileId?: string, allowNetwork: boolean = false, isLight: boolean = false): string {
    const activeFile = vfs.getActiveFile();
    let targetNode: VirtualNode | undefined;

    if (targetFileId) {
      const node = vfs.getNode(targetFileId);
      if (node && !node.isFolder) targetNode = node;
    }

    const effectiveFile = targetNode || activeFile;

    // 0. If effective file is a Note/Markdown format, compile to clean responsive interactive HTML preview
    if (effectiveFile && (
      ['markdown', 'org', 'rst', 'adoc', 'log', 'todo', 'plaintext'].includes(effectiveFile.language) ||
      /\.(md|markdown|txt|org|rst|adoc|asciidoc|log|todo|task)$/i.test(effectiveFile.name)
    )) {
      return this.renderMarkdown(effectiveFile.name, effectiveFile.content, isLight, allowNetwork);
    }

    let htmlFile: VirtualNode | undefined = targetNode;

    // 1. If active file is HTML, preview that exact file
    if (!htmlFile && activeFile && (activeFile.language === 'html' || activeFile.name.toLowerCase().endsWith('.html'))) {
      htmlFile = activeFile;
    }

    // 2. Otherwise, look for index.html in the active file's folder
    if (!htmlFile && activeFile && activeFile.parentId) {
      const siblings = vfs.getChildren(activeFile.parentId);
      htmlFile = siblings.find(f => !f.isFolder && f.name.toLowerCase() === 'index.html') 
              || siblings.find(f => !f.isFolder && f.language === 'html');
    }

    // 3. Fallback to any index.html or first html file in VFS
    if (!htmlFile) {
      const allFiles = vfs.getAllFiles();
      htmlFile = allFiles.find(f => f.name.toLowerCase() === 'index.html')
              || allFiles.find(f => f.language === 'html');
    }

    let htmlContent = htmlFile ? htmlFile.content : '<!DOCTYPE html><html><body style="background:#000;color:#fff;font-family:sans-serif;padding:20px;"><h3>No HTML or Markdown content to display</h3><p>Open or create an HTML or Markdown file and tap Run.</p></body></html>';

    // Intercept console.log inside the iframe and send to parent
    const consoleInterceptorScript = `
      <script>
        (function() {
          const originalLog = console.log;
          const originalError = console.error;
          const originalWarn = console.warn;
          
          function sendToParent(type, args) {
            try {
              window.parent.postMessage({
                source: 'aero-ide-preview',
                type: type,
                text: Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
              }, '*');
            } catch(e) {}
          }
          
          console.log = function(...args) {
            sendToParent('stdout', args);
            originalLog.apply(console, args);
          };
          console.error = function(...args) {
            sendToParent('error', args);
            originalError.apply(console, args);
          };
          console.warn = function(...args) {
            sendToParent('stderr', args);
            originalWarn.apply(console, args);
          };
          
          window.onerror = function(msg, url, line) {
            sendToParent('error', ['Error at line ' + line + ': ' + msg]);
          };
        })();
      </script>
    `;

    // Replace linked stylesheet with inline CSS from VFS
    htmlContent = htmlContent.replace(/<link\s+[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, (_match, filename) => {
      const cleanName = filename.replace(/^\.\//, '').replace(/^\//, '');
      const cssFile = vfs.getFileByName(cleanName) || (htmlFile?.parentId ? vfs.getChildren(htmlFile.parentId).find(f => f.name === cleanName) : undefined);
      if (cssFile) {
        return `<style>\n/* Inlined: ${cleanName} */\n${cssFile.content}\n</style>`;
      }
      return _match;
    });

    // Replace linked scripts with inline JS from VFS
    htmlContent = htmlContent.replace(/<script\s+[^>]*src=["']([^"']+\.js)["'][^>]*>\s*<\/script>/gi, (_match, filename) => {
      const cleanName = filename.replace(/^\.\//, '').replace(/^\//, '');
      const jsFile = vfs.getFileByName(cleanName) || (htmlFile?.parentId ? vfs.getChildren(htmlFile.parentId).find(f => f.name === cleanName) : undefined);
      if (jsFile) {
        return `<script>\n/* Inlined: ${cleanName} */\n${jsFile.content}\n</script>`;
      }
      return _match;
    });

    // Finding 7: Inject Content Security Policy to restrict outbound network requests by default.
    // connect-src 'none' blocks fetch, XMLHttpRequest, WebSocket, and EventSource.
    const cspMeta = allowNetwork
      ? `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' https: data: blob:; form-action 'none';">`
      : `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data: blob:; connect-src 'none'; form-action 'none';">`;

    // Insert CSP and interceptor into <head> or at beginning
    const injection = `\n${cspMeta}\n${consoleInterceptorScript}\n`;
    if (htmlContent.includes('<head>')) {
      htmlContent = htmlContent.replace('<head>', '<head>' + injection);
    } else {
      htmlContent = injection + htmlContent;
    }

    return htmlContent;
  }

  public static renderMarkdown(title: string, md: string, isLight: boolean = false, allowNetwork: boolean = false): string {
    const rawLines = md.split('\n');
    const processedLines: string[] = [];

    const hasMath = allowNetwork && (md.includes('$$') || /\$[^$\n]+\$/.test(md));
    const hasMermaid = allowNetwork && md.includes('```mermaid');

    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeBlockBuffer: string[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];

      // Code block delimiters
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLang = line.trim().slice(3).trim();
          codeBlockBuffer = [];
          continue;
        } else {
          inCodeBlock = false;
          if (codeBlockLang.toLowerCase() === 'mermaid') {
            processedLines.push(`<div class="mermaid-block my-4 p-3 bg-black/40 rounded-xl border border-white/5 overflow-x-auto flex justify-center"><pre class="mermaid">${this.escapeHtml(codeBlockBuffer.join('\n'))}</pre></div>`);
          } else {
            const codeContent = this.escapeHtml(codeBlockBuffer.join('\n'));
            processedLines.push(`<div class="code-block"><div class="code-header">${codeBlockLang || 'code'}</div><pre><code>${codeContent}</code></pre></div>`);
          }
          continue;
        }
      }

      if (inCodeBlock) {
        codeBlockBuffer.push(line);
        continue;
      }

      // Check task items e.g. "- [ ] item" or "- [x] item" or "* [ ]" or "1. [ ]"
      const taskMatch = /^(\s*[-*+]|\s*\d+\.)\s+\[([ xX])\]\s*(.*)$/.exec(line);
      if (taskMatch) {
        const isChecked = taskMatch[2].toLowerCase() === 'x';
        const taskContent = this.formatInlineMarkdown(taskMatch[3]);
        processedLines.push(`<li class="task-item"><label class="task-label"><input type="checkbox" class="task-checkbox" data-line-index="${i}" ${isChecked ? 'checked' : ''}><span class="task-text ${isChecked ? 'task-done' : ''}">${taskContent}</span></label></li>`);
        continue;
      }

      // Unordered list
      const bulletMatch = /^(\s*[-*+])\s+(.*)$/.exec(line);
      if (bulletMatch) {
        processedLines.push(`<li>${this.formatInlineMarkdown(bulletMatch[2])}</li>`);
        continue;
      }

      // Ordered list
      const numMatch = /^(\s*\d+\.)\s+(.*)$/.exec(line);
      if (numMatch) {
        processedLines.push(`<li class="numbered-item">${this.formatInlineMarkdown(numMatch[2])}</li>`);
        continue;
      }

      // Headers
      if (line.startsWith('### ')) {
        processedLines.push(`<h3>${this.formatInlineMarkdown(line.slice(4))}</h3>`);
        continue;
      }
      if (line.startsWith('## ')) {
        processedLines.push(`<h2>${this.formatInlineMarkdown(line.slice(3))}</h2>`);
        continue;
      }
      if (line.startsWith('# ')) {
        processedLines.push(`<h1>${this.formatInlineMarkdown(line.slice(2))}</h1>`);
        continue;
      }

      // Blockquotes
      if (line.startsWith('> ')) {
        processedLines.push(`<blockquote>${this.formatInlineMarkdown(line.slice(2))}</blockquote>`);
        continue;
      }

      // Horizontal rule
      if (line.trim() === '---' || line.trim() === '***') {
        processedLines.push('<hr>');
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        processedLines.push('<div class="empty-space"></div>');
        continue;
      }

      // Normal paragraph text
      processedLines.push(`<p>${this.formatInlineMarkdown(line)}</p>`);
    }

    const bodyHtml = processedLines.join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>

  ${hasMath ? `
  <!-- KaTeX Math Rendering -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" crossorigin="anonymous">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" crossorigin="anonymous"
    onload="if(window.renderMathInElement){ renderMathInElement(document.body, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false }); }"></script>
  ` : ''}

  ${hasMermaid ? `
  <!-- Mermaid Diagrams Rendering -->
  <script defer src="https://cdn.jsdelivr.net/npm/mermaid@10.4.0/dist/mermaid.min.js"></script>
  ` : ''}

  <style>
    :root {
      color-scheme: ${isLight ? 'light' : 'dark'};
      --bg: ${isLight ? '#ffffff' : '#09090b'};
      --text: ${isLight ? '#0f172a' : '#f1f5f9'};
      --h1: ${isLight ? '#312e81' : '#a5b4fc'};
      --h2: ${isLight ? '#4338ca' : '#818cf8'};
      --h3: ${isLight ? '#4f46e5' : '#c7d2fe'};
      --border: ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'};
      --code-bg: ${isLight ? '#f8fafc' : '#141418'};
      --code-border: ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'};
      --code-header: ${isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)'};
      --code-text: ${isLight ? '#0f172a' : '#e2e8f0'};
      --inline-code-bg: ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)'};
      --inline-code-text: ${isLight ? '#db2777' : '#f472b6'};
      --quote-bg: ${isLight ? 'rgba(99,102,241,0.08)' : 'rgba(129,140,248,0.06)'};
      --quote-text: ${isLight ? '#334155' : '#cbd5e1'};
    }
    body {
      margin: 0;
      padding: 24px 20px 80px;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.7;
      font-size: 15px;
      max-width: 760px;
      margin: 0 auto;
    }
    h1, h2, h3, h4 {
      color: var(--text);
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 700;
      line-height: 1.3;
    }
    h1 { font-size: 24px; border-bottom: 1px solid var(--border); padding-bottom: 8px; color: var(--h1); }
    h2 { font-size: 20px; border-bottom: 1px solid var(--border); padding-bottom: 6px; color: var(--h2); }
    h3 { font-size: 17px; color: var(--h3); }
    p { margin: 0.8em 0; }
    a { color: #0284c7; text-decoration: underline; text-underline-offset: 2px; }
    a:hover { color: #38bdf8; }
    blockquote {
      border-left: 3.5px solid var(--h2);
      padding: 4px 16px;
      margin: 1em 0;
      background: var(--quote-bg);
      border-radius: 0 8px 8px 0;
      color: var(--quote-text);
    }
    .code-block {
      background: var(--code-bg);
      border: 1px solid var(--code-border);
      border-radius: 12px;
      margin: 1.2em 0;
      overflow: hidden;
    }
    .code-header {
      background: var(--code-header);
      padding: 4px 12px;
      font-size: 11px;
      font-family: monospace;
      color: #94a3b8;
      border-bottom: 1px solid var(--code-border);
      text-transform: uppercase;
    }
    pre {
      margin: 0;
      padding: 14px;
      overflow-x: auto;
      font-family: 'Fira Code', Consolas, monospace;
      font-size: 13px;
      line-height: 1.5;
      color: var(--code-text);
    }
    .inline-code {
      background: var(--inline-code-bg);
      padding: 2px 6px;
      border-radius: 6px;
      font-family: 'Fira Code', monospace;
      font-size: 13px;
      color: var(--inline-code-text);
    }
    ul, ol { padding-left: 24px; margin: 0.8em 0; }
    li { margin: 0.3em 0; }
    pre {
      margin: 0;
      padding: 14px;
      overflow-x: auto;
      font-family: 'Fira Code', Consolas, monospace;
      font-size: 13px;
      line-height: 1.5;
      color: #e2e8f0;
    }
    .inline-code {
      background: rgba(255,255,255,0.1);
      padding: 2px 6px;
      border-radius: 6px;
      font-family: 'Fira Code', monospace;
      font-size: 13px;
      color: #f472b6;
    }
    ul, ol { padding-left: 24px; margin: 0.8em 0; }
    li { margin: 0.3em 0; }
    
    /* Interactive Checkbox Styles */
    .task-item {
      list-style: none;
      margin-left: -20px;
      display: flex;
      align-items: center;
      margin: 0.4em 0;
    }
    .task-label {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      user-select: none;
    }
    .task-checkbox {
      appearance: none;
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      border: 2px solid #64748b;
      border-radius: 5px;
      background: #141418;
      cursor: pointer;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      flex-shrink: 0;
    }
    .task-checkbox:checked {
      background: #4ade80;
      border-color: #4ade80;
    }
    .task-checkbox:checked::after {
      content: '';
      width: 5px;
      height: 9px;
      border: solid #000000;
      border-width: 0 2.2px 2.2px 0;
      transform: rotate(45deg);
      margin-bottom: 2px;
    }
    .task-text {
      color: #f1f5f9;
      transition: all 0.15s ease;
    }
    .task-done {
      text-decoration: line-through;
      color: #64748b !important;
    }
    hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 2em 0; }
    .empty-space { height: 12px; }
  </style>
</head>
<body>
  ${bodyHtml}

  <script>
    document.addEventListener('change', function(e) {
      if (e.target && e.target.classList.contains('task-checkbox')) {
        var lineIndex = parseInt(e.target.getAttribute('data-line-index'), 10);
        var isChecked = e.target.checked;
        var label = e.target.closest('.task-label');
        if (label) {
          var textSpan = label.querySelector('.task-text');
          if (textSpan) {
            if (isChecked) {
              textSpan.classList.add('task-done');
            } else {
              textSpan.classList.remove('task-done');
            }
          }
        }
        try {
          window.parent.postMessage({
            source: 'aero-ide-preview',
            type: 'toggle-task',
            lineIndex: lineIndex,
            checked: isChecked
          }, '*');
        } catch(err) {}
      }
    });

    if (window.mermaid) {
      try {
        mermaid.initialize({ startOnLoad: true, theme: '${isLight ? 'default' : 'dark'}', securityLevel: 'strict' });
      } catch(e) {}
    }
  </script>
</body>
</html>`;
  }

  private static formatInlineMarkdown(raw: string): string {
    let t = this.escapeHtml(raw);
    // Inline code `code`
    t = t.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    // Bold & italic
    t = t.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*(.*?)\*/g, '<em>$1</em>');
    t = t.replace(/~~(.*?)~~/g, '<del>$1</del>');
    // Links [text](url)
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Raw URLs <http...>
    t = t.replace(/&lt;(https?:\/\/[^&>]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    return t;
  }

  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
