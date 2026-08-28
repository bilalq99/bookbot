// PLACEHOLDER — owned by agent S1 (server-auth-users). Replace the bodies;
// keep these exported signatures EXACTLY (other agents compile against them).
// bcryptjs sync API, cost 10.

export function hashPassword(_password: string): string {
  throw new Error('not implemented')
}

export function verifyPassword(_password: string, _hash: string): boolean {
  throw new Error('not implemented')
}
