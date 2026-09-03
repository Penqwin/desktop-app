export {};

declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>;
      gitStatus: () => Promise<{ success: boolean; data?: any; error?: string }>;
      gitDiff: (target: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      gitBranches: () => Promise<{ success: boolean; data?: string[]; current?: string; error?: string }>;
      selectDirectory: () => Promise<{ success: boolean; data?: string; error?: string }>;
      gitLog: (repoPath?: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
      gitDiffCommits: (hashes: string[], repoPath?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      generateDoc: (payload: any) => Promise<{ success: boolean; data?: string; error?: string }>;
    };
  }
}
