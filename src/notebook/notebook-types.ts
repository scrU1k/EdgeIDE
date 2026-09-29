export type NotebookCellType = 'code' | 'markdown' | 'raw';

export interface NotebookOutput {
  output_type: 'stream' | 'execute_result' | 'display_data' | 'error';
  name?: 'stdout' | 'stderr';
  text?: string[] | string;
  data?: {
    'text/plain'?: string[] | string;
    'text/html'?: string[] | string;
    'image/png'?: string;
    'image/jpeg'?: string;
    'image/svg+xml'?: string[] | string;
    [key: string]: any;
  };
  ename?: string;
  evalue?: string;
  traceback?: string[];
  execution_count?: number | null;
}

export interface NotebookCell {
  id: string;
  cell_type: NotebookCellType;
  source: string;
  execution_count: number | null;
  outputs: NotebookOutput[];
  metadata: Record<string, any>;
  rendered?: boolean; // For markdown cells (default true when rendered)
}

export interface NotebookData {
  cells: NotebookCell[];
  metadata: {
    language_info?: {
      name: string;
      version?: string;
      [key: string]: any;
    };
    kernelspec?: {
      display_name: string;
      language: string;
      name: string;
    };
    [key: string]: any;
  };
  nbformat: number;
  nbformat_minor: number;
}

export function generateCellId(): string {
  return 'cell_' + Math.random().toString(36).substring(2, 9);
}

export function createCell(type: NotebookCellType = 'code', source: string = ''): NotebookCell {
  return {
    id: generateCellId(),
    cell_type: type,
    source,
    execution_count: null,
    outputs: [],
    metadata: {},
    rendered: type === 'markdown'
  };
}

export function createDefaultNotebook(): NotebookData {
  return {
    cells: [
      {
        id: generateCellId(),
        cell_type: 'markdown',
        source: '# Welcome to EdgeIDE Jupyter Notebook\n\nRun code cells individually with the **Play** button or execute all cells sequentially with **Run All**.',
        execution_count: null,
        outputs: [],
        metadata: {},
        rendered: true
      },
      {
        id: generateCellId(),
        cell_type: 'code',
        source: 'import sys\nprint(f"Python {sys.version}")\n\nx = 10\ny = 20\nprint(f"Result: {x + y}")',
        execution_count: null,
        outputs: [],
        metadata: {},
        rendered: false
      }
    ],
    metadata: {
      language_info: {
        name: 'python',
        version: '3.12'
      },
      kernelspec: {
        display_name: 'Python 3 (Pyodide / Host)',
        language: 'python',
        name: 'python3'
      }
    },
    nbformat: 4,
    nbformat_minor: 4
  };
}

export function parseNotebook(rawJson: string): NotebookData {
  if (!rawJson || !rawJson.trim()) {
    return createDefaultNotebook();
  }

  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return createDefaultNotebook();
    }

    const cells: NotebookCell[] = [];
    const rawCells = Array.isArray(parsed.cells) ? parsed.cells : [];

    for (let i = 0; i < rawCells.length; i++) {
      const c = rawCells[i];
      if (!c || typeof c !== 'object') continue;

      let cellType: NotebookCellType = 'code';
      if (c.cell_type === 'markdown' || c.cell_type === 'raw') {
        cellType = c.cell_type;
      }

      // Convert source array to single string
      let src = '';
      if (Array.isArray(c.source)) {
        src = c.source.join('');
      } else if (typeof c.source === 'string') {
        src = c.source;
      }

      const cellId = typeof c.id === 'string' && c.id ? c.id : generateCellId();
      const execCount = typeof c.execution_count === 'number' ? c.execution_count : null;
      const outputs = Array.isArray(c.outputs) ? c.outputs : [];

      cells.push({
        id: cellId,
        cell_type: cellType,
        source: src,
        execution_count: execCount,
        outputs,
        metadata: c.metadata && typeof c.metadata === 'object' ? c.metadata : {},
        rendered: cellType === 'markdown'
      });
    }

    if (cells.length === 0) {
      cells.push(createCell('code', ''));
    }

    return {
      cells,
      metadata: parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : {
        language_info: { name: 'python' }
      },
      nbformat: typeof parsed.nbformat === 'number' ? parsed.nbformat : 4,
      nbformat_minor: typeof parsed.nbformat_minor === 'number' ? parsed.nbformat_minor : 4
    };
  } catch {
    return createDefaultNotebook();
  }
}

export function serializeNotebook(nb: NotebookData): string {
  const formattedCells = nb.cells.map(c => {
    // Standard Jupyter nbformat represents multi-line source as array of lines
    const sourceLines = c.source.split('\n').map((line, idx, arr) => {
      return idx < arr.length - 1 ? line + '\n' : line;
    });

    const cellObj: any = {
      cell_type: c.cell_type,
      metadata: c.metadata || {},
      source: sourceLines
    };

    if (c.cell_type === 'code') {
      cellObj.execution_count = c.execution_count;
      cellObj.outputs = c.outputs || [];
    }

    if (c.id) {
      cellObj.id = c.id;
    }

    return cellObj;
  });

  const outputObj = {
    cells: formattedCells,
    metadata: nb.metadata || { language_info: { name: 'python' } },
    nbformat: nb.nbformat || 4,
    nbformat_minor: nb.nbformat_minor || 4
  };

  return JSON.stringify(outputObj, null, 2);
}
