import assert from 'node:assert/strict'
import test from 'node:test'
import {
  unwrapPixivJumpLinks,
  unwrapPixivJumpUrl,
} from '../app/utils/pixivJumpLink.ts'

test('解开 Pixiv 外站确认页链接', () => {
  assert.equal(
    unwrapPixivJumpUrl(
      'https://www.pixiv.net/jump.php?url=https%3A%2F%2Fexample.com%2Fworks%3Fa%3D1%26b%3D2'
    ),
    'https://example.com/works?a=1&b=2'
  )
  assert.equal(
    unwrapPixivJumpUrl('/jump.php?https%3A%2F%2Fexample.com%2Fprofile'),
    'https://example.com/profile'
  )
})

test('作品简介只改写 Pixiv 中转链接并正确转义属性', () => {
  const html =
    '<p><a class="external" href="https://www.pixiv.net/jump.php?url=https%3A%2F%2Fexample.com%2F%3Fa%3D1%26b%3D2" target="_blank">主页</a> <a href="https://www.pixiv.net/artworks/42">作品</a></p>'

  assert.equal(
    unwrapPixivJumpLinks(html),
    '<p><a class="external" href="https://example.com/?a=1&amp;b=2" target="_blank">主页</a> <a href="https://www.pixiv.net/artworks/42">作品</a></p>'
  )
})

test('不解包非 Pixiv 地址或非网页协议', () => {
  assert.equal(
    unwrapPixivJumpUrl(
      'https://example.com/jump.php?url=https%3A%2F%2Foutside.example'
    ),
    'https://example.com/jump.php?url=https%3A%2F%2Foutside.example'
  )
  assert.equal(
    unwrapPixivJumpUrl(
      'https://www.pixiv.net/jump.php?url=javascript%3Aalert(1)'
    ),
    'https://www.pixiv.net/jump.php?url=javascript%3Aalert(1)'
  )
})
