// src/utils/github/config.ts

/**
 * Robustly parses the GitHub private key.
 * Vercel environment variables often escape newlines (literal \n).
 * This function ensures they are converted back to actual newline characters.
 */
function getSanitizedPrivateKey() {
    const key = process.env.GITHUB_PRIVATE_KEY;
    if (!key) return undefined;

    // Handle escaped newlines (\n) which are common in Vercel dashboard env vars
    return key.replace(/\\n/g, '\n');
}

export const GITHUB_CONFIG = {
    APP_ID: process.env.GITHUB_APP_ID,
    CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    PRIVATE_KEY: getSanitizedPrivateKey(),
    WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
};

export function validateGitHubConfig() {
    if (!GITHUB_CONFIG.APP_ID || !GITHUB_CONFIG.PRIVATE_KEY) {
        throw new Error('Missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY in environment variables');
    }
}
