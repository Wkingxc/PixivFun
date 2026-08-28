import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isOpenInNewViewGesture,
  shouldRecordArtworkVisitGesture,
} from '../app/utils/linkGestures.ts'

function mouseEvent(init: {
  button: number
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}): MouseEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...init,
  } as MouseEvent
}

test('中键和带 ctrl/cmd/shift 的左键都算作新标签页打开', () => {
  assert.equal(isOpenInNewViewGesture(mouseEvent({ button: 1 })), true)
  assert.equal(
    isOpenInNewViewGesture(mouseEvent({ button: 0, ctrlKey: true })),
    true
  )
  assert.equal(
    isOpenInNewViewGesture(mouseEvent({ button: 0, metaKey: true })),
    true
  )
  assert.equal(
    isOpenInNewViewGesture(mouseEvent({ button: 0, shiftKey: true })),
    true
  )
})

test('普通左键、alt 左键和右键不算新标签页打开', () => {
  assert.equal(isOpenInNewViewGesture(mouseEvent({ button: 0 })), false)
  // Alt+click is the browser's download gesture, the page stays put.
  assert.equal(
    isOpenInNewViewGesture(mouseEvent({ button: 0, altKey: true })),
    false
  )
  assert.equal(isOpenInNewViewGesture(mouseEvent({ button: 2 })), false)
  assert.equal(
    isOpenInNewViewGesture(mouseEvent({ button: 2, ctrlKey: true })),
    false
  )
})

test('作品访问记录覆盖普通左键和所有新视图打开手势', () => {
  assert.equal(shouldRecordArtworkVisitGesture(mouseEvent({ button: 0 })), true)
  assert.equal(shouldRecordArtworkVisitGesture(mouseEvent({ button: 1 })), true)
  assert.equal(
    shouldRecordArtworkVisitGesture(mouseEvent({ button: 0, ctrlKey: true })),
    true
  )
  assert.equal(
    shouldRecordArtworkVisitGesture(mouseEvent({ button: 0, altKey: true })),
    false
  )
  assert.equal(
    shouldRecordArtworkVisitGesture(mouseEvent({ button: 2 })),
    false
  )
})
