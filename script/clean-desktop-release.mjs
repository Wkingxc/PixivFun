import { mkdirSync, rmSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const workspace = resolve('.')
const releaseDirectory = resolve(workspace, 'release')
const stagingDirectory = resolve(workspace, '.desktop-release')

function assertWorkspaceChild(path) {
  const pathFromWorkspace = relative(workspace, path)
  if (
    !pathFromWorkspace ||
    pathFromWorkspace.startsWith('..') ||
    resolve(workspace, pathFromWorkspace) !== path
  ) {
    throw new Error(`拒绝清理工作区外的目录：${path}`)
  }
}

for (const directory of [releaseDirectory, stagingDirectory]) {
  assertWorkspaceChild(directory)
  rmSync(directory, { recursive: true, force: true })
}

mkdirSync(stagingDirectory, { recursive: true })
console.log('Desktop 发布目录已清理。')
