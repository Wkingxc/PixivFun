/**
 * Copy prototype members of mixin classes onto the target class. All mixins
 * must share the target's base class so instance state resolves at runtime.
 */
export function applyMixins(
  target: { prototype: object },
  mixins: Array<{ prototype: object }>
): void {
  for (const mixin of mixins) {
    for (const name of Object.getOwnPropertyNames(mixin.prototype)) {
      if (name === 'constructor') continue
      const descriptor = Object.getOwnPropertyDescriptor(mixin.prototype, name)
      if (descriptor) {
        Object.defineProperty(target.prototype, name, descriptor)
      }
    }
  }
}
