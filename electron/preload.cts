import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  gitStatus: () => ipcRenderer.invoke('git-status'),
  gitDiff: (target: string) => ipcRenderer.invoke('git-diff', target),
  gitBranches: () => ipcRenderer.invoke('git-branches'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  gitLog: (repoPath?: string) => ipcRenderer.invoke('git-log', repoPath),
  gitDiffCommits: (hashes: string[], repoPath?: string) => ipcRenderer.invoke('git-diff-commits', hashes, repoPath),
  readDirRecursive: (dirPath: string) => ipcRenderer.invoke('read-dir-recursive', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  generateDoc: (payload: any) => ipcRenderer.invoke('generate-doc', payload),
  getChangedFilesFromDiff: (diffText: string) => ipcRenderer.invoke('get-changed-files-from-diff', diffText),
});
