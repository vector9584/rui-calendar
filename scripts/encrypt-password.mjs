#!/usr/bin/env node

/**
 * Encrypt a CalDAV password with a master password.
 *
 * Usage:
 *   node scripts/encrypt-password.mjs --master "your-master-password" --password "your-caldav-password"
 *
 * Output: JSON blob ready to paste into calino.config.json
 */

import { webcrypto } from 'node:crypto'

// Polyfill globalThis.crypto for Node.js < 19
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto
}

const PBKDF2_ITERATIONS = 600_000

function parseArgs() {
  const args = process.argv.slice(2)
  let master = null
  let url = null
  let username = null
  let password = null
  let webcalUrl = null
  let webcalName = null
  let refreshIntervalMinutes = null
  let proxyUrl = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--master' && args[i + 1]) {
      master = args[++i]
    } else if (args[i] === '--url' && args[i + 1]) {
      url = args[++i]
    } else if (args[i] === '--username' && args[i + 1]) {
      username = args[++i]
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[++i]
    } else if (args[i] === '--webcal-url' && args[i + 1]) {
      webcalUrl = args[++i]
    } else if (args[i] === '--name' && args[i + 1]) {
      webcalName = args[++i]
    } else if (args[i] === '--refresh-minutes' && args[i + 1]) {
      refreshIntervalMinutes = Number(args[++i])
    } else if (args[i] === '--proxy-url' && args[i + 1]) {
      proxyUrl = args[++i]
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage (CalDAV account):
  encrypt-password --master <master> --url <url> --username <user> --password <pass>

Usage (webcal subscription):
  encrypt-password --master <master> --webcal-url <url> --name <name> [--refresh-minutes <n>] [--proxy-url <url>]

Options:
  --master <password>          Master password to encrypt with
  --url <url>                  CalDAV server URL
  --username <username>        CalDAV username
  --password <password>        CalDAV password
  --webcal-url <url>           Webcal/.ics subscription URL (mutually exclusive with --url/--username/--password)
  --name <name>                Display name for the webcal subscription
  --refresh-minutes <n>        Refresh interval in minutes (default 60, not encrypted)
  --proxy-url <url>            Optional CORS proxy URL (not encrypted)
  --help, -h                   Show this help

Examples:
  node scripts/encrypt-password.mjs --master "my-master" --url "https://caldav.example.com/dav.php" --username "user" --password "caldav-pass"
  node scripts/encrypt-password.mjs --master "my-master" --webcal-url "https://example.com/calendar.ics" --name "Holidays"
`)
      process.exit(0)
    }
  }

  if (webcalUrl) {
    if (!master || !webcalName) {
      console.error('Error: --master and --name are required with --webcal-url')
      console.error('Run with --help for usage')
      process.exit(1)
    }
    return {
      mode: 'webcal',
      master,
      webcalUrl,
      webcalName,
      refreshIntervalMinutes,
      proxyUrl,
    }
  }

  if (!master || !url || !username || !password) {
    console.error('Error: --master, --url, --username, and --password are all required')
    console.error('Run with --help for usage')
    process.exit(1)
  }

  return { mode: 'caldav', master, url, username, password }
}

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64url')
}

async function deriveKey(password, salt) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
}

async function encrypt(plaintext, masterPassword) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(masterPassword, salt)
  const encoder = new TextEncoder()

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )

  return {
    ciphertext: toBase64(encrypted),
    iv: toBase64(iv.buffer),
    salt: toBase64(salt.buffer),
  }
}

async function main() {
  const parsed = parseArgs()

  if (parsed.mode === 'webcal') {
    const { master, webcalUrl, webcalName, refreshIntervalMinutes, proxyUrl } = parsed

    console.log('\nEncrypting webcal subscription...')
    console.log(`Master password: ${'*'.repeat(master.length)}`)
    console.log('')

    const encryptedUrl = await encrypt(webcalUrl, master)

    const entry = {
      name: webcalName,
      url: encryptedUrl,
      ...(refreshIntervalMinutes ? { refreshIntervalMinutes } : {}),
      ...(proxyUrl ? { proxyUrl } : {}),
    }

    console.log('webcalSubscriptions entry (paste into calino.config.json):')
    console.log('─'.repeat(50))
    console.log(JSON.stringify(entry, null, 2))
    console.log('─'.repeat(50))
    return
  }

  const { master, url, username, password } = parsed

  console.log('\nEncrypting CalDAV credentials...')
  console.log(`Master password: ${'*'.repeat(master.length)}`)
  console.log('')

  const [encryptedUrl, encryptedUsername, encryptedPassword] = await Promise.all([
    encrypt(url, master),
    encrypt(username, master),
    encrypt(password, master),
  ])

  console.log('Account entry (paste into calino.config.json):')
  console.log('─'.repeat(50))
  console.log(JSON.stringify({
    name: username,
    url: encryptedUrl,
    username: encryptedUsername,
    password: encryptedPassword,
  }, null, 2))
  console.log('─'.repeat(50))
}

main().catch((err) => {
  console.error('Encryption failed:', err)
  process.exit(1)
})
