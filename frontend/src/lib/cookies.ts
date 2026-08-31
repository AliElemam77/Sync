import Cookies from 'js-cookie';

const TOKEN_KEY = 'sync_access_token';

export const setAuthToken = (token: string): void => {
  Cookies.set(TOKEN_KEY, token, {
    expires: 1, // 1 day
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
};

export const getAuthToken = (): string | undefined => {
  return Cookies.get(TOKEN_KEY);
};

export const removeAuthToken = (): void => {
  Cookies.remove(TOKEN_KEY, { path: '/' });
};
