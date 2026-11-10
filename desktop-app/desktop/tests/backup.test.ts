import { describe, expect, it } from 'vitest'
import { decryptBackup, encryptBackup } from '../src/main/backup'

describe('encrypted backup', () => {
  it('round trips and rejects a wrong password', async () => {
    const encrypted = await encryptBackup('{"events":[]}', 'correct horse battery staple')
    await expect(decryptBackup(encrypted, 'correct horse battery staple')).resolves.toBe('{"events":[]}')
    await expect(decryptBackup(encrypted, 'wrong password')).rejects.toThrow('密码不正确')
  })
})
