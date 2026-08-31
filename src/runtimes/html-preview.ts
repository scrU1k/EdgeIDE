import { VirtualFileSystem } from '../vfs/vfs';
import { VirtualNode } from '../vfs/types';

export class HtmlPreviewBuilder {
  public static buildBundle(vfs: VirtualFileSystem, targetFileId?: string): string {
    const activeFile = vfs.getActiveFile();
    let htmlFile: VirtualNode | undefined;

    if (targetFileId) {
      const node = vfs.getNode(targetFileId);
      if (node && !node.isFolder) htmlFile = node;
    }

    // 0. If active file is Markdown (.md), compile to clean responsive HTML preview
    if (!htmlFile && activeFile && (activeFile.language === 'markdown' || activeFile.name.toLowerCase().endsWith('.md'))) {
      return this.renderMarkdown(activeFile.name, activeFile.content);
    }

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

    // Insert interceptor into <head> or at beginning
    if (htmlContent.includes('<head>')) {
      htmlContent = htmlContent.replace('<head>', '<head>\n' + consoleInterceptorScript);
    } else {
      htmlContent = consoleInterceptorScript + htmlContent;
    }

    return htmlContent;
  }

  public static renderMarkdown(title: string, md: string): string {
    let body = this.escapeHtml(md);

    // Code blocks
    body = body.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
      return `<div class="code-block"><div class="code-header">${lang || 'code'}</div><pre><code>${code}</code></pre></div>`;
    });

    // Inline code
    body = body.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Headers
    body = body.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    body = body.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    body = body.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold & Italic
    body = body.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    body = body.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    body = body.replace(/\*(.*?)\*/g, '<em>$1</em>');
    body = body.replace(/~~(.*?)~~/g, '<del>$1</del>');

    // Blockquotes
    body = body.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Horizontal Rule
    body = body.replace(/^---$/gim, '<hr>');

    // Task list items
    body = body.replace(/^- \[x\] (.*$)/gim, '<li class="task-item"><input type="checkbox" checked disabled> $1</li>');
    body = body.replace(/^- \[ \] (.*$)/gim, '<li class="task-item"><input type="checkbox" disabled> $1</li>');

    // Lists
    body = body.replace(/^[*-] (.*$)/gim, '<li>$1</li>');
    body = body.replace(/^\d+\. (.*$)/gim, '<li class="numbered-item">$1</li>');

    // Links
    body = body.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Paragraphs
    body = body.replace(/\n\n/g, '</p><p>');
    body = body.replace(/\n/g, '<br>');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      padding: 24px 20px 80px;
      background: #09090b;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.7;
      font-size: 15px;
      max-width: 760px;
      margin: 0 auto;
    }
    h1, h2, h3, h4 {
      color: #f8fafc;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 700;
      line-height: 1.3;
    }
    h1 { font-size: 24px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; }
    h2 { font-size: 20px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px; }
    h3 { font-size: 17px; }
    p { margin: 0.8em 0; }
    a { color: #818cf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    blockquote {
      border-left: 3.5px solid #818cf8;
      padding: 4px 16px;
      margin: 1em 0;
      background: rgba(129, 140, 248, 0.06);
      border-radius: 0 8px 8px 0;
      color: #cbd5e1;
    }
    .code-block {
      background: #141418;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      margin: 1.2em 0;
      overflow: hidden;
    }
    .code-header {
      background: rgba(255,255,255,0.03);
      padding: 4px 12px;
      font-size: 11px;
      font-family: monospace;
      color: #94a3b8;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      text-transform: uppercase;
    }
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
    .task-item { list-style: none; margin-left: -20px; display: flex; align-items: center; gap: 8px; }
    hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 2em 0; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
  }

  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
