type StyleObject = Record<string, string>

function camelCase(property: string): string {
  return property.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase())
}

export default function styleToJs(style: string): StyleObject {
  const output: StyleObject = {}
  if (!style || typeof style !== 'string') return output
  for (const declaration of style.split(';')) {
    const separator = declaration.indexOf(':')
    if (separator < 1) continue
    const property = declaration.slice(0, separator).trim()
    const value = declaration.slice(separator + 1).trim()
    if (property && value) output[camelCase(property)] = value
  }
  return output
}
