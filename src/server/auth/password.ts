// Password hashing — bcryptjs sync API, cost 10 (docs/SPEC.md §8).
import { compareSync, hashSync } from 'bcryptjs'

const BCRYPT_COST = 10

export function hashPassword(password: string): string {
  return hashSync(password, BCRYPT_COST)
}

export function verifyPassword(password: string, hash: string): boolean {
  return compareSync(password, hash)
}
