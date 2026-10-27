import { describe, it, expect } from 'vitest'
import { extractThemeName, extractCSSSection } from '../loader'

describe('theme loader', () => {
  describe('extractThemeName', () => {
    it('extracts theme name from CSS comment with light mode', () => {
      const css = `/* Theme: My Custom Theme | light */
:root { --color-bg: #fff; }`
      const result = extractThemeName(css, 'my-theme.css')

      expect(result.name).toBe('My Custom Theme')
      expect(result.isDark).toBe(false)
    })

    it('extracts theme name from CSS comment with dark mode', () => {
      const css = `/* Theme: OLED Dark | dark */
:root { --color-bg: #000; }`
      const result = extractThemeName(css, 'oled.css')

      expect(result.name).toBe('OLED Dark')
      expect(result.isDark).toBe(true)
    })

    it('extracts theme name from CSS comment without mode', () => {
      const css = `/* Theme: Default Theme */
:root { --color-bg: #fff; }`
      const result = extractThemeName(css, 'default.css')

      expect(result.name).toBe('Default Theme')
      expect(result.isDark).toBe(false)
    })

    it('generates name from filename when no comment', () => {
      const css = `:root { --color-bg: #fff; }`
      const result = extractThemeName(css, 'warm-light.css')

      expect(result.name).toBe('Warm Light')
      expect(result.isDark).toBe(false)
    })

    it('handles kebab-case filenames', () => {
      const css = `:root { --color-bg: #fff; }`
      const result = extractThemeName(css, 'my-custom-theme.css')

      expect(result.name).toBe('My Custom Theme')
    })

    it('handles snake_case filenames', () => {
      const css = `:root { --color-bg: #fff; }`
      const result = extractThemeName(css, 'dark_blue_theme.css')

      expect(result.name).toBe('Dark Blue Theme')
    })

    it('handles case-insensitive mode', () => {
      const css = `/* Theme: Dark | DARK */
:root { --color-bg: #000; }`
      const result = extractThemeName(css, 'dark.css')

      expect(result.isDark).toBe(true)
    })
  })

  describe('extractCSSSection', () => {
    const multiSectionCSS = `
/* Theme: My Theme | both */
:root,
[data-theme='light'] {
  --canvas: #faf8f3;
  --accent: #b07d4f;
  --radius-sm: 7px;
}

[data-theme='dark'] {
  --canvas: #1a1816;
  --accent: #c9956a;
  --radius-sm: 7px;
}
`

    it('extracts the light section (root + [data-theme=light])', () => {
      const result = extractCSSSection(multiSectionCSS, 'light')
      expect(result).toContain('--canvas: #faf8f3')
      expect(result).toContain('--accent: #b07d4f')
      expect(result).not.toContain('--canvas: #1a1816')
    })

    it('extracts the dark section', () => {
      const result = extractCSSSection(multiSectionCSS, 'dark')
      expect(result).toContain('--canvas: #1a1816')
      expect(result).toContain('--accent: #c9956a')
      expect(result).not.toContain('--canvas: #faf8f3')
    })

    it('returns the full CSS when no section markers found', () => {
      const simpleCSS = ':root { --canvas: #fff; }'
      const result = extractCSSSection(simpleCSS, 'light')
      expect(result).toBe(simpleCSS)
    })

    it('handles CSS with nested rules', () => {
      const cssWithNested = `
:root,
[data-theme='light'] {
  --canvas: #faf8f3;
  .child { color: red; }
  .grandchild { .deeper { color: blue; } }
}
`
      const result = extractCSSSection(cssWithNested, 'light')
      expect(result).toContain('--canvas: #faf8f3')
      expect(result).toContain('.child { color: red; }')
    })
  })
})
