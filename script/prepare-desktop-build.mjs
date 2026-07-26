import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { resolve } from 'node:path'

const envPath = resolve('.env')
if (existsSync(envPath)) loadEnvFile(envPath)

const googleDriveClientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim()
const googleDriveClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim()
if (
  !googleDriveClientId ||
  !googleDriveClientId.endsWith('.apps.googleusercontent.com')
) {
  throw new Error('请在 .env 或构建环境中配置有效的 GOOGLE_DRIVE_CLIENT_ID')
}
if (!googleDriveClientSecret) {
  throw new Error('请在 .env 或构建环境中配置有效的 GOOGLE_DRIVE_CLIENT_SECRET')
}

const outputDirectory = resolve('desktop', 'generated')
mkdirSync(outputDirectory, { recursive: true })
writeFileSync(
  resolve(outputDirectory, 'google-oauth.json'),
  `${JSON.stringify(
    { googleDriveClientId, googleDriveClientSecret },
    null,
    2
  )}\n`,
  'utf8'
)

console.log('Desktop OAuth 配置已生成。')
