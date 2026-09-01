export type SupportedLanguage = 
  | 'python' 
  | 'javascript' 
  | 'typescript' 
  | 'react' 
  | 'html' 
  | 'css' 
  | 'cpp' 
  | 'json' 
  | 'ruby'
  | 'swift'
  | 'go'
  | 'julia'
  | 'powershell'
  | 'r'
  | 'sql'
  | 'kotlin'
  | 'rust'
  | 'java'
  | 'php'
  | 'markdown' 
  | 'org'
  | 'rst'
  | 'adoc'
  | 'log'
  | 'todo'
  | 'plaintext';

export interface VirtualNode {
  id: string;
  name: string;
  path: string;
  parentId: string | null; // null means root level
  isFolder: boolean;
  isDraft?: boolean; // True for temporary in-memory drafts not yet in explorer
  content: string;
  language: SupportedLanguage;
  isExpanded?: boolean; // For folders
  order?: number; // Custom sorting order
  updatedAt: number;
}

export type VirtualFile = VirtualNode;

export interface ProjectState {
  files: Record<string, VirtualNode>;
  activeFileId: string;
  openTabs: string[];
}
