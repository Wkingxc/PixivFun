import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getUgoiraDuration,
  getUgoiraFrameIndexAtProgress,
  getUgoiraPlaybackProgress,
} from '../app/utils/ugoiraTimeline.ts'

const frames = [{ delay: 100 }, { delay: 200 }, { delay: 300 }]

test('动图时间轴按每帧延时计算播放进度和拖动位置', () => {
  assert.equal(getUgoiraDuration(frames), 600)
  assert.equal(getUgoiraPlaybackProgress(frames, 0), 0)
  assert.ok(Math.abs(getUgoiraPlaybackProgress(frames, 1) - 100 / 6) < 1e-10)
  assert.equal(getUgoiraPlaybackProgress(frames, 2), 50)

  assert.equal(getUgoiraFrameIndexAtProgress(frames, 0), 0)
  assert.equal(getUgoiraFrameIndexAtProgress(frames, 20), 1)
  assert.equal(getUgoiraFrameIndexAtProgress(frames, 50), 2)
  assert.equal(getUgoiraFrameIndexAtProgress(frames, 100), 2)
})
