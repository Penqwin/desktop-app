import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
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
    }
    else {
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
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
ipcMain.handle('git-diff', async (_event, target) => {
    try {
        // If target is HEAD, get working directory diff
        // Else, get diff between target and HEAD (or similar logic)
        const diff = await git.diff([target]);
        return { success: true, data: diff };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
ipcMain.handle('git-branches', async () => {
    try {
        const branches = await git.branch();
        return { success: true, data: branches.all, current: branches.current };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
ipcMain.handle('select-directory', async () => {
    try {
        const win = BrowserWindow.getFocusedWindow();
        const opts = { properties: ['openDirectory'] };
        const { canceled, filePaths } = await dialog.showOpenDialog(opts);
        if (!canceled && filePaths.length > 0) {
            const selectedPath = filePaths[0];
            await git.cwd(selectedPath);
            return { success: true, data: selectedPath };
        }
        return { success: false, error: 'Canceled' };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
ipcMain.handle('git-log', async (_event, repoPath) => {
    try {
        if (repoPath)
            await git.cwd(repoPath);
        const log = await git.log({ maxCount: 50 });
        return { success: true, data: log.all };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
ipcMain.handle('git-diff-commits', async (_event, hashes, repoPath) => {
    try {
        if (repoPath)
            await git.cwd(repoPath);
        let combinedDiff = '';
        for (const hash of hashes) {
            // Get commit message
            const showMsg = await git.show(['-s', '--format=%h - %s%n%b', hash]);
            // Get commit diff
            const diff = await git.show([hash, '--pretty=format:']);
            combinedDiff += `\n\n--- Commit: ${showMsg.trim()} ---\n\n${diff}`;
        }
        return { success: true, data: combinedDiff.trim() };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// --- AI Generation IPC Handlers ---
ipcMain.handle('generate-doc', async (_event, payload) => {
    const { apiKey, modelName, systemInstruction, userMessage } = payload;
    try {
        const result = await generateDocFromDiff(apiKey, modelName || 'gemini-2.5-flash', systemInstruction, userMessage);
        return { success: true, data: result };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
