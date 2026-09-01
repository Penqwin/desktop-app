"use server";

import { App, Octokit } from "octokit";
import { GITHUB_CONFIG, validateGitHubConfig } from "./config";

export const getGitHubClient = async (
  installationId?: string | number | null,
) => {
  validateGitHubConfig();

  const numericInstallationId =
    typeof installationId === "string"
      ? parseInt(installationId, 10)
      : installationId;

  if (numericInstallationId) {
    console.log(
      "Creating GitHub client for installation ID:",
      numericInstallationId,
    );
    try {
      const app = new App({
        appId: GITHUB_CONFIG.APP_ID!,
        privateKey: GITHUB_CONFIG.PRIVATE_KEY!,
      });

      // Returns an octokit instance specifically for this installation
      return await app.getInstallationOctokit(numericInstallationId);
    } catch (err: any) {
      console.warn(
        `Failed to create GitHub client for installation ID ${numericInstallationId}: ${err.message}. Falling back to generic client.`
      );
    }
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) {
    console.log("Creating generic GitHub client with GITHUB_TOKEN");
    return new Octokit({ auth: githubToken });
  }

  console.log("Creating generic unauthenticated GitHub client");
  return new Octokit();
};
