const openingTagName = (line: string) => {
  const match = line.match(/^<([^!?/\s>]+)(?:\s[^>]*)?>/)
  return match?.[1] ?? ''
}

const hasInlineClosingTag = (line: string, tagName: string) =>
  Boolean(tagName && line.endsWith(`</${tagName}>`))

export const formatXmlForDisplay = (rawXml: string) => {
  const source = String(rawXml ?? '').trim()
  if (!source) return ''

  const lines = source
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  let depth = 0

  return lines.map(line => {
    const closing = /^<\//.test(line)
    if (closing) depth = Math.max(0, depth - 1)

    const formatted = `${'  '.repeat(depth)}${line}`

    const tagName = openingTagName(line)
    const opensElement = Boolean(tagName)
    const selfClosing = /\/>$/.test(line)
    const declarationOrMeta = /^<\?|^<!/.test(line)
    const closesInline = hasInlineClosingTag(line, tagName)

    if (opensElement && !selfClosing && !declarationOrMeta && !closesInline) {
      depth += 1
    }

    return formatted
  }).join('\n')
}
