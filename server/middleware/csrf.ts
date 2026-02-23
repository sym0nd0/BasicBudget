import { doubleCsrf } from 'csrf-csrf';
import { config } from '../config.js';

const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => config.SESSION_SECRET,
  cookieName: 'bb.csrf',
  cookieOptions: {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
  },
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string | undefined,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});

export { doubleCsrfProtection, generateToken };
