import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => ipcRenderer.invoke('ping'),
    gitStatus: () => ipcRenderer.invoke('git-status'),
    gitDiff: (target) => ipcRenderer.invoke('git-diff', target),
    gitBranches: () => ipcRenderer.invoke('git-branches'),
    generateDoc: (payload) => ipcRenderer.invoke('generate-doc', payload),
});
