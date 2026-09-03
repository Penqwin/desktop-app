import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { simpleGit } from 'simple-git';
import { generateDocFromDiff } from './ai/gemini.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize simple-git in the current working directory
const git = simpleGit();

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Check if we are running in dev mode
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    // In production, load the static HTML file
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Basic IPC handler for testing
ipcMain.handle('ping', () => 'pong');

// --- Git IPC Handlers ---

ipcMain.handle('git-status', async () => {
  try {
    const status = await git.status();
    return { success: true, data: status };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-diff', async (_event, target: string) => {
  try {
    // If target is HEAD, get working directory diff
    // Else, get diff between target and HEAD (or similar logic)
    const diff = await git.diff([target]);
    return { success: true, data: diff };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-branches', async () => {
  try {
    const branches = await git.branch();
    return { success: true, data: branches.all, current: branches.current };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-directory', async () => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    const opts = { properties: ['openDirectory'] as ('openDirectory' | 'openFile')[] };
    const { canceled, filePaths } = await dialog.showOpenDialog(opts);
      
    if (!canceled && filePaths.length > 0) {
      const selectedPath = filePaths[0];
      await git.cwd(selectedPath);
      return { success: true, data: selectedPath };
    }
    return { success: false, error: 'Canceled' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-log', async (_event, repoPath?: string) => {
  try {
    if (repoPath) await git.cwd(repoPath);
    const log = await git.log({ maxCount: 50 });
    return { success: true, data: log.all };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-diff-commits', async (_event, hashes: string[], repoPath?: string) => {
  try {
    if (repoPath) await git.cwd(repoPath);
    let combinedDiff = '';
    for (const hash of hashes) {
      // Get commit message
      const showMsg = await git.show(['-s', '--format=%h - %s%n%b', hash]);
      // Get commit diff, excluding lockfiles and common binary/image extensions to save LLM tokens
      const diff = await git.show([
        hash, 
        '--pretty=format:', 
        '--', 
        '.', 
        ':(exclude)*.lock', 
        ':(exclude)*.svg', 
        ':(exclude)*.png',
        ':(exclude)*.jpg',
        ':(exclude)*.jpeg',
        ':(exclude)*.webp',
        ':(exclude)*.gif'
      ]);
      combinedDiff += `\n\n--- Commit: ${showMsg.trim()} ---\n\n${diff}`;
    }
    return { success: true, data: combinedDiff.trim() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// --- File System IPC Handlers ---

ipcMain.handle('read-dir-recursive', async (_event, dirPath: string) => {
  try {
    await git.cwd(dirPath);
    // Use git ls-files to get all tracked (-c) and untracked but not ignored (-o) files
    // --exclude-standard ensures we respect .gitignore
    const rawFiles = await git.raw(['ls-files', '-c', '-o', '--exclude-standard']);
    const files = rawFiles.split('\n').map(f => f.trim()).filter(f => f.length > 0);
    
    // Filter to only include text-like files to avoid sending binaries/images to Gemini
    const results = files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      const validExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.go', '.rs', '.py', '.rb', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.css', '.html'];
      return validExts.includes(ext) || ext === '';
    });
    
    return { success: true, data: results };
  } catch (error: any) {
    // Fallback if not a git repository
    try {
      const results: string[] = [];
      const walk = (currentPath: string) => {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build', 'out'].includes(entry.name)) continue;
          const fullPath = path.join(currentPath, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else {
            const ext = path.extname(entry.name).toLowerCase();
            const validExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.go', '.rs', '.py', '.rb', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.css', '.html'];
            if (validExts.includes(ext) || ext === '') {
              results.push(path.relative(dirPath, fullPath));
            }
          }
        }
      };
      walk(dirPath);
      return { success: true, data: results };
    } catch (fallbackErr: any) {
      return { success: false, error: fallbackErr.message };
    }
  }
});

ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, data: content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// --- AI Generation IPC Handlers ---

ipcMain.handle('generate-doc', async (_event, payload) => {
  const { apiKey, modelName, systemInstruction, userMessage, isBootstrap } = payload;
  try {
    const result = await generateDocFromDiff(apiKey, modelName || 'gemini-2.5-flash', systemInstruction, userMessage, isBootstrap);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
