import type { PixivUser } from '~/types'

let authenticatedSession = false

export function hasAuthenticatedSession(): boolean {
  return authenticatedSession
}

export async function initUser(): Promise<PixivUser> {
  try {
    const data = await $fetch<{ userData: PixivUser }>('/api/auth/session', {
      headers: { 'Cache-Control': 'no-store' },
    })
    authenticatedSession = true
    return data.userData
  } catch (error) {
    authenticatedSession = false
    throw error
  }
}

export async function login(phpsessid: string): Promise<PixivUser> {
  if (!validateSessionId(phpsessid)) {
    throw new Error('访问令牌格式错误')
  }

  const data = await $fetch<{ userData: PixivUser }>('/api/auth/session', {
    method: 'POST',
    body: { phpsessid },
  })
  authenticatedSession = true
  return data.userData
}

export async function logout(): Promise<boolean> {
  if (!confirm('确定要断开当前 Pixiv 账户连接吗？')) return false

  await $fetch('/api/auth/session', { method: 'DELETE' })
  authenticatedSession = false
  return true
}

export function validateSessionId(token: string): boolean {
  return /^\d{2,10}_[0-9A-Za-z]{32}$/.test(token)
}

export function exampleSessionId(): string {
  const uid = new Uint32Array(1)
  window.crypto.getRandomValues(uid)
  const secret = (() => {
    const strSet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const final = []
    const indexes = new Uint8Array(32)
    window.crypto.getRandomValues(indexes)
    for (const i of indexes) {
      const charIndex = Math.floor((i * strSet.length) / 256)
      final.push(strSet[charIndex])
    }
    return `${uid[0]}_${final.join('')}`
  })()
  return secret
}
