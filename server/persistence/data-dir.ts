import { homedir } from 'node:os'
import { join } from 'node:path'

export interface AppDataDirOptions {
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  homeDir?: string
}

export function resolveAppDataDir(options: AppDataDirOptions = {}): string {
  const env = options.env ?? process.env
  if (env.PIXIVFUN_DATA_DIR?.trim()) return env.PIXIVFUN_DATA_DIR.trim()

  const platform = options.platform ?? process.platform
  const userHome = options.homeDir ?? homedir()
  if (platform === 'darwin') {
    return join(userHome, 'Library', 'Application Support', 'PixivFun')
  }
  if (platform === 'win32') {
    return join(env.APPDATA || join(userHome, 'AppData', 'Roaming'), 'PixivFun')
  }
  return join(
    env.XDG_DATA_HOME || join(userHome, '.local', 'share'),
    'PixivFun'
  )
}
