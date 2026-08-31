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

    let htmlContent = htmlFile ? htmlFile.content : '<!DOCTYPE html><html><body style="background:#000;color:#fff;font-family:sans-serif;padding:20px;"><h3>No HTML content to display</h3><p>Open or create an HTML file and tap Run.</p></body></html>';

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
}
