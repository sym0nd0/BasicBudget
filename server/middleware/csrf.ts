import { doubleCsrf } from 'csrf-csrf';
import { config, isHttpDeployment } from '../config.js';

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => config.SESSION_SECRET,
  getSessionIdentifier: (req) => req.sessionID ?? '',
  cookieName: 'bb.csrf',
  cookieOptions: {
    httpOnly: true,
    secure: !isHttpDeployment && config.NODE_ENV === 'production',
    sameSite: 'lax',
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'] as string | undefined,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});

export { doubleCsrfProtection, generateCsrfToken };
