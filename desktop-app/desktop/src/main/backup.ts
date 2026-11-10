import { randomBytes, scrypt as scryptCallback, createCipheriv, createDecipheriv } from 'node:crypto'
import { promisify } from 'node:util'
import { z } from 'zod'

const scrypt = promisify(scryptCallback)
const backupSchema = z.object({
  format: z.literal('ruili-encrypted-backup'), version: z.literal(1),
  salt: z.string().regex(/^[a-f\d]{32}$/), iv: z.string().regex(/^[a-f\d]{24}$/),
  tag: z.string().regex(/^[a-f\d]{32}$/), data: z.string().max(100 * 1024 * 1024),
}).strict()

export async function encryptBackup(data: string, password: string): Promise<string> {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await scrypt(password, salt, 32) as Buffer
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()])
  key.fill(0)
  return JSON.stringify({ format: 'ruili-encrypted-backup', version: 1, salt: salt.toString('hex'), iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: encrypted.toString('base64') })
}

export async function decryptBackup(text: string, password: string): Promise<string> {
  const backup = backupSchema.parse(JSON.parse(text) as unknown)
  const key = await scrypt(password, Buffer.from(backup.salt, 'hex'), 32) as Buffer
  try {
    const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(backup.iv, 'hex'))
    cipher.setAuthTag(Buffer.from(backup.tag, 'hex'))
    return Buffer.concat([cipher.update(Buffer.from(backup.data, 'base64')), cipher.final()]).toString('utf8')
  } catch {
    throw new Error('备份密码不正确，或备份文件已损坏。现有数据未改变。')
  } finally {
    key.fill(0)
  }
}
