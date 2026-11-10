type PlainRecord = Record<string, unknown>

function isRecord(value: unknown): value is PlainRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function merge(target: PlainRecord, source: PlainRecord): PlainRecord {
  for (const [key, value] of Object.entries(source)) {
    if (isRecord(value)) {
      const current = isRecord(target[key]) ? target[key] : {}
      target[key] = merge(current, value)
    } else if (Array.isArray(value)) {
      target[key] = value.slice()
    } else {
      target[key] = value
    }
  }
  return target
}

export default function extend(
  deepOrTarget: boolean | PlainRecord,
  ...sources: PlainRecord[]
): PlainRecord {
  const deep = typeof deepOrTarget === 'boolean'
  const target = (deep ? sources.shift() : deepOrTarget) ?? {}
  if (!isRecord(target)) return {}
  for (const source of sources) {
    if (isRecord(source)) {
      if (deep) merge(target, source)
      else Object.assign(target, source)
    }
  }
  return target
}
