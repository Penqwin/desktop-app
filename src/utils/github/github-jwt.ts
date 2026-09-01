import jwt from 'jsonwebtoken';
import { GITHUB_CONFIG, validateGitHubConfig } from './config';

export function getGitHubAppJwt() {
  validateGitHubConfig();

  const iat = Math.floor(Date.now() / 1000) - 60; // Issued at (1 minute ago)
  const exp = iat + (10 * 60); // Expires exactly 10 minutes after iat

  const payload = {
    iat,
    exp,
    iss: GITHUB_CONFIG.APP_ID!, // Issuer (Your App ID)
  };

  return jwt.sign(payload, GITHUB_CONFIG.PRIVATE_KEY!, { algorithm: 'RS256' });
}