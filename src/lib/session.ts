import { v4 as uuidv4 } from 'crypto';

const SESSION_KEY = 'volts_user_id';
const SESSION_NAME_KEY = 'volts_user_name';

export function generateUserId(): string {
  return crypto.randomUUID();
}

export function getStoredUserId(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function getStoredUserName(): string | null {
  return sessionStorage.getItem(SESSION_NAME_KEY);
}

export function storeSession(userId: string, name: string) {
  sessionStorage.setItem(SESSION_KEY, userId);
  sessionStorage.setItem(SESSION_NAME_KEY, name);
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_NAME_KEY);
}
