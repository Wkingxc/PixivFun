import { createHash, randomBytes } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

export interface MasterKeyOptions {
  dataDir: string
  configuredSecret?: string
}

function configuredKey(secret: string): Buffer {
  if (secret.length < 32) {
    throw new Error('NUXT_SESSION_SECRET must contain at least 32 characters')
  }
  return createHash('sha256').update(secret, 'utf8').digest()
}

export function ensureMasterKey(options: MasterKeyOptions): Buffer {
  const configuredSecret = options.configuredSecret?.trim()
  if (configuredSecret) return configuredKey(configuredSecret)

  mkdirSync(options.dataDir, { recursive: true, mode: 0o700 })
  const keyPath = join(options.dataDir, 'master.key')
  try {
    const stats = statSync(keyPath)
    if (process.platform !== 'win32' && (stats.mode & 0o077) !== 0) {
      throw new Error(
        'master.key permissions must be restricted to the current user'
      )
    }
    const encoded = readFileSync(keyPath, 'utf8').trim()
    const key = Buffer.from(encoded, 'base64url')
    if (key.length !== 32 || key.toString('base64url') !== encoded) {
      throw new Error('master.key is invalid')
    }
    return key
  } catch (error) {
    if (
      error instanceof Error &&
      !('code' in error && error.code === 'ENOENT')
    ) {
      throw error
    }
  }

  const key = randomBytes(32)
  let descriptor: number | undefined
  try {
    descriptor = openSync(keyPath, 'wx', 0o600)
    writeFileSync(descriptor, `${key.toString('base64url')}\n`, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      return ensureMasterKey(options)
    }
    throw error
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
  if (process.platform !== 'win32') chmodSync(keyPath, 0o600)
  return key
}
