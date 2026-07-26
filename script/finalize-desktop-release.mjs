import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const workspace = resolve('.')
const releaseDirectory = resolve(workspace, 'release')
const stagingDirectory = resolve(workspace, '.desktop-release')
const unpackedDirectory = resolve(stagingDirectory, 'win-unpacked')
const finalDirectory = resolve(releaseDirectory, 'PixivFun')

function assertWorkspaceChild(path) {
  const pathFromWorkspace = relative(workspace, path)
  if (
    !pathFromWorkspace ||
    pathFromWorkspace.startsWith('..') ||
    resolve(workspace, pathFromWorkspace) !== path
  ) {
    throw new Error(`拒绝操作工作区外的目录：${path}`)
  }
}

for (const directory of [
  releaseDirectory,
  stagingDirectory,
  unpackedDirectory,
  finalDirectory,
]) {
  assertWorkspaceChild(directory)
}

if (!existsSync(unpackedDirectory)) {
  throw new Error(`未找到 Electron 目录版产物：${unpackedDirectory}`)
}

rmSync(releaseDirectory, { recursive: true, force: true })
mkdirSync(releaseDirectory, { recursive: true })
renameSync(unpackedDirectory, finalDirectory)
rmSync(stagingDirectory, { recursive: true, force: true })

console.log(`Desktop 目录版已生成：${finalDirectory}`)
