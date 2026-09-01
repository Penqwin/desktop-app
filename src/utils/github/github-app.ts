import { App } from "octokit";
import { GITHUB_CONFIG, validateGitHubConfig } from "./config";

export const getGithubAppClient = () => {
  validateGitHubConfig();
  return new App({
    appId: GITHUB_CONFIG.APP_ID!,
    privateKey: GITHUB_CONFIG.PRIVATE_KEY!,
  });
};