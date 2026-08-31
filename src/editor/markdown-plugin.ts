import { EditorView, Decoration, MatchDecorator, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { Extension } from '@codemirror/state';

// 1. Headers decorator (# ...)
const headerMatcher = new MatchDecorator({
  regexp: /^(#{1,6})\s+.*$/gm,
  decoration: () => Decoration.mark({ class: 'cm-md-header' })
});

const headerPlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = headerMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = headerMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: v => v.decorations }
);

// 2. URLs decorator
const urlMatcher = new MatchDecorator({
  regexp: /https?:\/\/[^\s)\]>]+|<https?:\/\/[^>]+>|\[[^\]]+\]\((https?:\/\/[^)]+)\)/g,
  decoration: () => Decoration.mark({ class: 'cm-md-url' })
});

const urlPlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = urlMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = urlMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: v => v.decorations }
);

// 3. Checked Checkboxes ([x] or [X])
const checkedMatcher = new MatchDecorator({
  regexp: /\[[xX]\]/g,
  decoration: () => Decoration.mark({ class: 'cm-md-checkbox-checked' })
});

const checkedPlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = checkedMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = checkedMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: v => v.decorations }
);

// 4. Empty Checkboxes ([ ])
const emptyMatcher = new MatchDecorator({
  regexp: /\[ \]/g,
  decoration: () => Decoration.mark({ class: 'cm-md-checkbox-empty' })
});

const emptyPlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = emptyMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = emptyMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: v => v.decorations }
);

// 5. Bullets and numbers
const bulletMatcher = new MatchDecorator({
  regexp: /^[ \t]*([-*+]|\d+\.)(?=\s)/gm,
  decoration: () => Decoration.mark({ class: 'cm-md-bullet' })
});

const bulletPlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = bulletMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = bulletMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: v => v.decorations }
);

// 6. Bold text
const boldMatcher = new MatchDecorator({
  regexp: /\*\*[^*]+\*\*/g,
  decoration: () => Decoration.mark({ class: 'cm-md-bold' })
});

const boldPlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = boldMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = boldMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: v => v.decorations }
);

// 7. Inline code
const codeMatcher = new MatchDecorator({
  regexp: /`[^`]+`/g,
  decoration: () => Decoration.mark({ class: 'cm-md-code' })
});

const codePlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = codeMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = codeMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: v => v.decorations }
);

export function getMarkdownSyntaxExtension(): Extension[] {
  return [
    headerPlugin,
    urlPlugin,
    checkedPlugin,
    emptyPlugin,
    bulletPlugin,
    boldPlugin,
    codePlugin
  ];
}
