import { getGitHubAppJwt } from "./github-jwt";

/**
 * Lists installations for the GitHub App.
 * Uses pagination to find an installation by account login (handle).
 */
export async function findInstallationByHandle(handle: string) {
    const jwtToken = getGitHubAppJwt();
    const cleanHandle = handle.toLowerCase().trim();

    let page = 1;
    const perPage = 100;

    while (true) {
        const response = await fetch(`https://api.github.com/app/installations?per_page=${perPage}&page=${page}`, {
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${jwtToken}`,
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'EngDoc-App'
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("GitHub App API Error:", {
                status: response.status,
                body: errorBody
            });
            throw new Error(`GitHub API returned ${response.status}`);
        }

        const installations = await response.json();

        if (!Array.isArray(installations) || installations.length === 0) {
            break;
        }

        const found = installations.find((inst: any) =>
            inst.account.login.toLowerCase() === cleanHandle
        );

        if (found) {
            return found;
        }

        if (installations.length < perPage) {
            break;
        }

        page++;
    }

    return null;
}

export async function getInstallationById(installationId: string | number) {
    const jwtToken = getGitHubAppJwt();

    const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${jwtToken}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'EngDoc-App'
        }
    });

    if (!response.ok) {
        return null;
    }

    return await response.json();
}

/**
 * Generates an installation access token.
 */
export async function getInstallationToken(installationId: number | string) {
    const jwtToken = getGitHubAppJwt();
    const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${jwtToken}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'EngDoc-App'
        }
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Failed to generate installation token:", {
            status: response.status,
            body: errorBody
        });
        throw new Error(`Failed to generate installation token: ${response.status} - ${errorBody}`);
    }
    
    const data = await response.json();
    return data.token;
}

/**
 * Checks if a GitHub user is an admin or owner of the installation.
 */
export async function verifyGithubUserPermissions(installationId: number, accountType: string, handle: string, username: string) {
    if (accountType.toLowerCase() === 'user') {
        return handle.toLowerCase() === username.toLowerCase();
    }
    
    // For Organizations, check if the user is an admin
    const token = await getInstallationToken(installationId);
    
    const response = await fetch(`https://api.github.com/orgs/${handle}/memberships/${username}`, {
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'EngDoc-App'
        }
    });

    if (response.status === 404 || response.status === 403) {
        return false; // Not a member or insufficient permissions
    }
    
    if (!response.ok) {
        console.error("GitHub Membership API Error:", response.status, await response.text());
        return false;
    }
    
    const data = await response.json();
    return data.role === 'admin';
}
