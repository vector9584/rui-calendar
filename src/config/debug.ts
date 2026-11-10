type DebugLogger = ((...args: unknown[]) => void) & {
  enabled: boolean
  namespace: string
}

export default function debug(namespace: string): DebugLogger {
  const logger = ((...args: unknown[]) => {
    void args
  }) as DebugLogger
  logger.enabled = false
  logger.namespace = namespace
  return logger
}

