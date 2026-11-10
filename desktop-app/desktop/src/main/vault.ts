import { existsSync, readFileSync } from 'node:fs'
import { safeStorage } from 'electron'
import { z } from 'zod'
import { credentialSchema } from '../shared/schema'
import type { Credential } from '../shared/schema'
import { writeAtomic } from './store'

export class CredentialVault {
  private encryptionAvailable = false
  constructor(private readonly path: string) {}
  async initialize(): Promise<void> {
    const available = await safeStorage.isAsyncEncryptionAvailable()
    this.encryptionAvailable = available && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text')
  }
  available(): boolean {
    return this.encryptionAvailable
  }
  private requireKeychain(): void {
    if (!this.available()) throw new Error('系统密码保险库不可用。请解锁钥匙串或启用系统密钥环后重试；密码未保存。')
  }
  async read(): Promise<Credential[]> {
    this.requireKeychain()
    if (!existsSync(this.path)) return []
    const envelope = z.object({ version: z.literal(1), encrypted: z.string() }).parse(JSON.parse(readFileSync(this.path, 'utf8')) as unknown)
    const decrypted = await safeStorage.decryptStringAsync(Buffer.from(envelope.encrypted, 'base64'))
    return z.array(credentialSchema).parse(JSON.parse(decrypted.result) as unknown)
  }
  async save(credential: Credential): Promise<void> {
    const value = credentialSchema.parse(credential)
    const all = (await this.read()).filter((item) => item.id !== value.id)
    await this.write([...all, value])
  }
  async delete(id: string): Promise<void> {
    await this.write((await this.read()).filter((item) => item.id !== id))
  }
  private async write(credentials: Credential[]): Promise<void> {
    this.requireKeychain()
    const encrypted = await safeStorage.encryptStringAsync(JSON.stringify(credentials))
    writeAtomic(this.path, JSON.stringify({ version: 1, encrypted: encrypted.toString('base64') }))
  }
}
