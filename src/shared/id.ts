import crypto from 'node:crypto';

export function generateId(): string {
  return crypto.randomBytes(16).toString('hex');
}
