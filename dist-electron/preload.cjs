"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => electron_1.ipcRenderer.invoke('ping'),
    gitStatus: () => electron_1.ipcRenderer.invoke('git-status'),
    gitDiff: (target) => electron_1.ipcRenderer.invoke('git-diff', target),
    gitBranches: () => electron_1.ipcRenderer.invoke('git-branches'),
    selectDirectory: () => electron_1.ipcRenderer.invoke('select-directory'),
    gitLog: (repoPath) => electron_1.ipcRenderer.invoke('git-log', repoPath),
    gitDiffCommits: (hashes, repoPath) => electron_1.ipcRenderer.invoke('git-diff-commits', hashes, repoPath),
    generateDoc: (payload) => electron_1.ipcRenderer.invoke('generate-doc', payload),
});
