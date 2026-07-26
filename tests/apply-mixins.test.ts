import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyMixins } from '../app/utils/applyMixins.ts'

class Base {
  protected value = 'shared'
}

class MixinA extends Base {
  readValue(): string {
    return this.value
  }
}

class MixinB extends Base {
  upperValue(): string {
    return this.value.toUpperCase()
  }
}

class Combined extends Base {}
interface Combined extends MixinA, MixinB {}
applyMixins(Combined, [MixinA, MixinB])

test('applyMixins 合并各域方法且共享基类实例状态', () => {
  const instance = new Combined()
  assert.equal(instance.readValue(), 'shared')
  assert.equal(instance.upperValue(), 'SHARED')
})

test('applyMixins 不覆盖 constructor 且方法定义在原型上', () => {
  assert.equal(Combined.prototype.constructor, Combined)
  assert.ok(Object.getOwnPropertyNames(Combined.prototype).includes('readValue'))
  assert.ok(!Object.prototype.hasOwnProperty.call(new Combined(), 'readValue'))
})
