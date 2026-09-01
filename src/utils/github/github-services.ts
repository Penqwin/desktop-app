import {getGithubAppClient} from "./github-app";

const app = getGithubAppClient();

export async function getPRDiff(installationId: string, owner: string, repo: string, pullNumber: number) {
  // Get an octokit instance specifically for this team
  const octokit = await app.getInstallationOctokit(parseInt(installationId));

  // Fetch the diff
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
    mediaType: { format: "diff" }, 
  });

  return data as unknown as string; // This returns the raw text diff
}