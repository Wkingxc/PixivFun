import { spawn } from 'node:child_process'
import { createWriteStream, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { app, dialog, Menu, nativeImage, shell, Tray } from 'electron'

const APP_NAME = 'PixivFun'
const STARTUP_TIMEOUT_MS = 30_000

let serverProcess
let serverLog
let serverUrl
let siteUrl
let tray

app.setName(APP_NAME)
app.setAppUserModelId('fun.pixiv.desktop')

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    void openPixivFun()
  })

  app.on('before-quit', stopServer)

  app.whenReady().then(startApplication).catch(showStartupError)
}

async function startApplication() {
  Menu.setApplicationMenu(null)
  createTray()

  const port = await reservePort()
  serverUrl = `http://127.0.0.1:${port}`
  siteUrl = `http://localhost:${port}`
  startServer(port)
  await waitForServer()
  await openPixivFun()
}

function createTray() {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon', 'PixivFunIcon.png')
    : join(app.getAppPath(), 'desktop', 'generated', 'PixivFunIcon.png')
  const icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) {
    throw new Error(`无法读取托盘图标：${iconPath}`)
  }

  tray = new Tray(icon)
  tray.setToolTip(APP_NAME)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '打开 PixivFun',
        click: () => {
          void openPixivFun()
        },
      },
      {
        label: '退出',
        click: () => app.quit(),
      },
    ])
  )
  tray.on('double-click', () => {
    void openPixivFun()
  })
}

function startServer(port) {
  const serverEntry = app.isPackaged
    ? join(process.resourcesPath, 'server', 'server', 'index.mjs')
    : join(app.getAppPath(), '.output', 'server', 'index.mjs')
  const configPath = app.isPackaged
    ? join(process.resourcesPath, 'config', 'google-oauth.json')
    : join(app.getAppPath(), 'desktop', 'generated', 'google-oauth.json')
  const config = JSON.parse(readFileSync(configPath, 'utf8'))

  if (
    typeof config.googleDriveClientId !== 'string' ||
    !config.googleDriveClientId.endsWith('.apps.googleusercontent.com')
  ) {
    throw new Error('打包的 Google Desktop OAuth client ID 无效')
  }
  if (
    typeof config.googleDriveClientSecret !== 'string' ||
    !config.googleDriveClientSecret
  ) {
    throw new Error('打包的 Google Desktop OAuth client secret 无效')
  }

  serverLog = createWriteStream(join(app.getPath('logs'), 'server.log'), {
    flags: 'a',
  })
  serverProcess = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      GOOGLE_DRIVE_CLIENT_ID: config.googleDriveClientId,
      GOOGLE_DRIVE_CLIENT_SECRET: config.googleDriveClientSecret,
      HOST: '127.0.0.1',
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: String(port),
      NODE_ENV: 'production',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  serverProcess.stdout.pipe(serverLog, { end: false })
  serverProcess.stderr.pipe(serverLog, { end: false })
}

async function waitForServer() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(
        `本地服务启动失败，退出码：${serverProcess.exitCode ?? '未知'}`
      )
    }
    try {
      const response = await fetch(serverUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(1_000),
      })
      if (response.status < 500) return
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error('本地服务启动超时')
}

async function openPixivFun() {
  if (!siteUrl) return
  await shell.openExternal(siteUrl)
}

function stopServer() {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill()
  }
  serverProcess = undefined
  serverLog?.end()
  serverLog = undefined
}

function reservePort() {
  return listenForAvailablePort(3000).catch((error) => {
    if (!(error instanceof Error) || !('code' in error)) throw error
    if (error.code !== 'EADDRINUSE' && error.code !== 'EACCES') throw error
    return listenForAvailablePort(0)
  })
}

function listenForAvailablePort(port) {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(port, '127.0.0.1', () => {
      const address = probe.address()
      if (!address || typeof address === 'string') {
        probe.close()
        reject(new Error('无法分配本地端口'))
        return
      }
      const { port } = address
      probe.close((error) => {
        if (error) reject(error)
        else resolve(port)
      })
    })
  })
}

function showStartupError(error) {
  const message = error instanceof Error ? error.message : String(error)
  dialog.showErrorBox(
    `${APP_NAME} 启动失败`,
    `${message}\n\n详细日志：${join(app.getPath('logs'), 'server.log')}`
  )
  app.quit()
}
