import assert from 'node:assert/strict'
import test from 'node:test'
import { toSassPath } from '../shared/sass-path.ts'

test('Sass 注入路径在 Windows 和 POSIX 上统一使用正斜杠', () => {
  assert.equal(
    toSassPath(
      String.raw`E:\BaiduNetdiskDownload\PixivFun\app\assets\styles\_fnb.scss`
    ),
    'E:/BaiduNetdiskDownload/PixivFun/app/assets/styles/_fnb.scss'
  )
  assert.equal(
    toSassPath('/Users/example/PixivFun/app/assets/styles/_fnb.scss'),
    '/Users/example/PixivFun/app/assets/styles/_fnb.scss'
  )
})
