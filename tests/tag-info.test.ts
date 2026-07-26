import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyTagInfo, normalizeTagInfo } from '../app/utils/tagInfo.ts'

test('标签信息解析出译名与 pixpedia 简介', () => {
  assert.deepEqual(
    normalizeTagInfo({
      body: {
        tag: 'Fate/GrandOrder',
        word: 'Fate/GrandOrder',
        pixpedia: {
          abstract: 'TYPE-MOONによる『Fate』シリーズ初のゲームである。',
          yomigana: 'ふぇいとぐらんどおーだー',
          parentTag: 'Fateシリーズ',
        },
        tagTranslation: {
          'Fate/GrandOrder': {
            en: 'Fate/Grand Order',
            zh: '命运－冠位指定',
            zh_tw: 'Fate/Grand Order',
          },
        },
      },
    }),
    {
      tag: 'Fate/GrandOrder',
      translation: '命运－冠位指定',
      abstract: 'TYPE-MOONによる『Fate』シリーズ初のゲームである。',
      yomigana: 'ふぇいとぐらんどおーだー',
      parentTag: 'Fateシリーズ',
    }
  )
})

test('中文译名为空时回退到英文，与 Pixiv 自身的显示顺序一致', () => {
  assert.equal(
    normalizeTagInfo({
      tag: '美少女',
      tagTranslation: {
        美少女: { en: 'Beautiful Girl', zh: '', zh_tw: '', romaji: 'bishoujo' },
      },
    }).translation,
    'Beautiful Girl'
  )
})

test('译名与标签本身相同时不重复展示', () => {
  assert.equal(
    normalizeTagInfo({
      tag: 'オリジナル',
      tagTranslation: { オリジナル: { zh: 'オリジナル' } },
    }).translation,
    ''
  )
})

test('缺少译名、简介或整体响应异常时安全降级', () => {
  assert.deepEqual(normalizeTagInfo({ body: { tag: '风景' } }), {
    tag: '风景',
    translation: '',
    abstract: '',
    yomigana: '',
    parentTag: '',
  })
  assert.deepEqual(normalizeTagInfo(null), emptyTagInfo())
  assert.deepEqual(normalizeTagInfo({ body: {} }, '  东方  '), {
    tag: '东方',
    translation: '',
    abstract: '',
    yomigana: '',
    parentTag: '',
  })
})
