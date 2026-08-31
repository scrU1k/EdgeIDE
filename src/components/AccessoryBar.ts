import { CodeEditor } from '../editor/editor';
import { Icons } from './icons';

interface KeyConfig {
  label?: string;
  icon?: string;
  insert?: string;
  action?: (editor: CodeEditor) => void;
  title?: string;
}

export class AccessoryBar {
  private container: HTMLElement;
  private editor: CodeEditor;

  private keys: KeyConfig[] = [
    { label: 'Tab', insert: '  ' },
    { label: '{ }', insert: '{}' },
    { label: '( )', insert: '()' },
    { label: '[ ]', insert: '[]' },
    { label: '" "', insert: '""' },
    { label: "' '", insert: "''" },
    { label: ';', insert: ';' },
    { label: ':', insert: ':' },
    { label: '=', insert: ' = ' },
    { label: '=>', insert: ' => ' },
    { label: '+', insert: ' + ' },
    { label: '-', insert: ' - ' },
    { label: '*', insert: ' * ' },
    { label: '/', insert: '/' },
    { label: '<', insert: '<' },
    { label: '>', insert: '>' },
    { label: '_', insert: '_' },
    { label: '$', insert: '$' },
    { label: '!', insert: '!' },
    { label: '&', insert: '&' },
    { label: '|', insert: '|' },
    { icon: Icons.arrowLeft, action: (ed) => ed.moveCursor(-1), title: 'Cursor Left' },
    { icon: Icons.arrowRight, action: (ed) => ed.moveCursor(1), title: 'Cursor Right' },
    { icon: Icons.undo, action: (ed) => ed.undo(), title: 'Undo' },
    { icon: Icons.redo, action: (ed) => ed.redo(), title: 'Redo' }
  ];

  constructor(parent: HTMLElement, editor: CodeEditor) {
    this.editor = editor;
    this.container = document.createElement('div');
    this.container.className = 'accessory-bar px-2 py-1 flex items-center bg-[#000000] shrink-0 select-none z-30 transition-transform duration-100 ease-out overflow-x-auto';
    this.render();
    parent.appendChild(this.container);

    this.bindVirtualKeyboard();
  }

  private bindVirtualKeyboard(): void {
    if (!window.visualViewport) return;

    const onViewportChange = () => {
      if (!window.visualViewport) return;
      const viewportHeight = window.visualViewport.height;
      const windowHeight = window.innerHeight;
      const keyboardHeight = Math.max(0, windowHeight - viewportHeight);

      if (keyboardHeight > 80) {
        // Keyboard is visible on screen
        this.container.style.transform = `translateY(-${keyboardHeight}px)`;
        this.container.classList.add('shadow-2xl', 'bg-[#09090b]');
      } else {
        // Keyboard hidden
        this.container.style.transform = 'translateY(0px)';
        this.container.classList.remove('shadow-2xl');
      }
    };

    window.visualViewport.addEventListener('resize', onViewportChange);
    window.visualViewport.addEventListener('scroll', onViewportChange);
  }

  private render(): void {
    this.container.innerHTML = '';
    for (const key of this.keys) {
      const btn = document.createElement('button');
      btn.className = 'accessory-btn shrink-0';
      if (key.icon) {
        btn.innerHTML = key.icon;
      } else if (key.label) {
        btn.textContent = key.label;
      }
      if (key.title) btn.title = key.title;

      let startX = 0;
      let startY = 0;
      let isMoved = false;

      btn.addEventListener('pointerdown', (e) => {
        startX = e.clientX;
        startY = e.clientY;
        isMoved = false;
      });

      btn.addEventListener('pointermove', (e) => {
        if (!isMoved) {
          const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
          if (dist > 8) {
            isMoved = true;
          }
        }
      });

      btn.addEventListener('pointerup', (e) => {
        if (isMoved) return; // Ignore drag/scroll gestures
        e.preventDefault();
        if (key.action) {
          key.action(this.editor);
        } else if (key.insert) {
          this.editor.insertText(key.insert);
        }
      });

      // Prevent losing editor focus on tap
      btn.addEventListener('mousedown', (e) => e.preventDefault());

      this.container.appendChild(btn);
    }
  }
}
