import { parseVCard, contactToVCard } from '../adapter/vCardAdapter'
import type { Contact } from '../types'

/**
 * Split a multi-vCard file content into individual vCard strings.
 */
export function splitVCards(content: string): string[] {
  // Normalize line endings and handle both \r\n and \n
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = normalized.split(/(?=BEGIN:VCARD)/i)
  return blocks
    .map((block) => block.trim())
    .filter((block) => block.length > 0 && /BEGIN:VCARD/i.test(block))
}

/**
 * Parse a .vcf file content into Contact objects.
 */
export function parseVCardFile(
  content: string,
  addressBookId: string,
  accountId: string
): Contact[] {
  const blocks = splitVCards(content)
  const contacts: Contact[] = []

  for (const block of blocks) {
    const contact = parseVCard(block, addressBookId, accountId)
    if (contact) {
      contacts.push(contact)
    }
  }

  return contacts
}

/**
 * Serialize multiple contacts to a .vcf file string.
 */
export function contactsToVCardFile(contacts: Contact[]): string {
  return contacts.map((c) => contactToVCard(c)).join('\r\n')
}

/**
 * Download a string as a file.
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string = 'text/vcard'
): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Read a File object as text.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
