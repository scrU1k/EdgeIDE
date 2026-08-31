export type SupportedLanguage = 
  | 'python' 
  | 'javascript' 
  | 'typescript' 
  | 'html' 
  | 'css' 
  | 'cpp' 
  | 'json' 
  | 'markdown' 
  | 'plaintext';

export interface VirtualNode {
  id: string;
  name: string;
  path: string;
  parentId: string | null; // null means root level
  isFolder: boolean;
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
