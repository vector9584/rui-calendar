/** Build-time CSS rules for the app-wide Font Size setting. */
export type FontSize = 'small' | 'default' | 'large' | 'xlarge'

interface CssRule {
  type: string
  selector: string
  clone: (overrides?: Record<string, unknown>) => CssRule
  append: (node: CssDeclaration) => void
  after: (node: CssRule) => void
}

interface CssDeclaration {
  prop: string
  value: string
  parent?: CssRule
  clone: (overrides?: Record<string, unknown>) => CssDeclaration
}

interface CssRoot {
  walkDecls: (callback: (decl: CssDeclaration) => void) => void
}

const ABSOLUTE_SIZE = /(?:\d*\.)?\d+(?:px|rem)\b|\b(?:var|clamp|min|max|calc)\(/

export function scaleFontSizeValue(value: string): string {
  return value.includes('--font-scale') || !ABSOLUTE_SIZE.test(value)
    ? value
    : `calc(${value} * var(--font-scale, 1))`
}

export function scaleFontShorthand(value: string): string {
  if (value.includes('--font-scale')) return value
  return value.replace(
    /(^|\s)((?:\d*\.)?\d+(?:px|rem))(?=[\s/]|$)/,
    (_, lead: string, size: string) => `${lead}calc(${size} * var(--font-scale, 1))`
  )
}

export const FONT_SIZE_OPTIONS: { value: FontSize; scale: number; labelKey: string }[] = [
  { value: 'small', scale: 0.9, labelKey: 'theme.fontSize.small' },
  { value: 'default', scale: 1, labelKey: 'theme.fontSize.default' },
  { value: 'large', scale: 1.15, labelKey: 'theme.fontSize.large' },
  { value: 'xlarge', scale: 1.3, labelKey: 'theme.fontSize.xlarge' },
]

export function fontScaleFor(fontSize: FontSize | undefined): number {
  return FONT_SIZE_OPTIONS.find((option) => option.value === fontSize)?.scale ?? 1
}

function scaledSize(size: string, scale: number): string {
  const match = /^((?:\d*\.)?\d+)(px|rem)$/.exec(size)
  if (!match) return size
  return `${Number((Number(match[1]) * scale).toFixed(4))}${match[2]}`
}

function shorthandSize(value: string): string | undefined {
  return /(?:^|\s)((?:\d*\.)?\d+(?:px|rem))(?=[\s/]|$)/.exec(value)?.[1]
}

export function fontScalePostcss() {
  return {
    postcssPlugin: 'calino-font-scale',
    OnceExit(root: unknown) {
      const cssRoot = root as CssRoot
      const sourceDeclarations: CssDeclaration[] = []
      cssRoot.walkDecls((decl) => sourceDeclarations.push(decl))

      for (const decl of sourceDeclarations) {
        if (decl.parent?.type !== 'rule') continue
        const rule = decl.parent
        const size = decl.prop === 'font-size' ? decl.value.trim() : decl.prop === 'font'
          ? shorthandSize(decl.value)
          : undefined
        if (!size || !ABSOLUTE_SIZE.test(size)) continue

        for (const option of FONT_SIZE_OPTIONS) {
          const override = rule.clone({
            selector: `:root[data-font-size="${option.value}"] ${rule.selector}`,
            nodes: [],
          })
          override.append(
            decl.clone({
              prop: 'font-size',
              value: scaledSize(size, option.scale),
            })
          )
          rule.after(override)
        }
      }
    },
  }
}
fontScalePostcss.postcss = true as const
