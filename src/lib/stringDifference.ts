export type StringDifference = {
  sameLength: boolean
  originLength: number
  targetLength: number
  extraInOrigin: boolean
  extraInTarget: boolean
  extraCharsOrigin: string
  extraCharsTarget: string
  firstDiffIndex: number
  originSnippet: string
  targetSnippet: string
  reasonText: string
}

const SNIPPET_LIMIT = 36

const charsOf = (value: string) => Array.from(value ?? '')

const characterWord = (count: number) => (count === 1 ? 'caractere' : 'caracteres')

const extraWord = (count: number) => (count === 1 ? 'caractere a mais' : 'caracteres a mais')

export const quoteSnippet = (value: string, limit = SNIPPET_LIMIT) => {
  const chars = charsOf(value)
  if (!chars.length) return "('')"
  if (chars.length <= limit) return `('${value}')`
  const keep = Math.max(8, limit - 1)
  const head = Math.ceil(keep * 0.65)
  const tail = Math.max(2, keep - head)
  return `('${chars.slice(0, head).join('')}…${chars.slice(-tail).join('')}')`
}

const countPhrase = (originLength: number, targetLength: number) => {
  if (originLength === targetLength) {
    return `Origem e destino possuem ${originLength} ${characterWord(originLength)}`
  }
  return `Origem: ${originLength} ${characterWord(originLength)}; destino: ${targetLength} ${characterWord(targetLength)}`
}

const alignDifference = (origin: string, target: string) => {
  const originChars = charsOf(origin)
  const targetChars = charsOf(target)
  const originLength = originChars.length
  const targetLength = targetChars.length

  let prefixLen = 0
  while (
    prefixLen < originLength
    && prefixLen < targetLength
    && originChars[prefixLen] === targetChars[prefixLen]
  ) {
    prefixLen += 1
  }

  let suffixLen = 0
  while (
    suffixLen < originLength - prefixLen
    && suffixLen < targetLength - prefixLen
    && originChars[originLength - 1 - suffixLen] === targetChars[targetLength - 1 - suffixLen]
  ) {
    suffixLen += 1
  }

  const originMiddle = originChars.slice(prefixLen, originLength - suffixLen).join('')
  const targetMiddle = targetChars.slice(prefixLen, targetLength - suffixLen).join('')
  const extraAtEnd = suffixLen === 0 && (
    (originMiddle === '' && prefixLen === originLength)
    || (targetMiddle === '' && prefixLen === targetLength)
  )

  return {
    originLength,
    targetLength,
    prefixLen,
    suffixLen,
    originMiddle,
    targetMiddle,
    extraAtEnd,
    firstDiffIndex: prefixLen === originLength && prefixLen === targetLength ? 0 : prefixLen + 1,
  }
}

const buildReasonText = (origin: string, target: string, aligned: ReturnType<typeof alignDifference>) => {
  const {
    originLength,
    targetLength,
    originMiddle,
    targetMiddle,
    extraAtEnd,
    firstDiffIndex,
  } = aligned

  if (!originLength && !targetLength) return ''
  if (!originLength) return `Origem sem valor e destino preenchido ${quoteSnippet(target)}.`
  if (!targetLength) return `Destino sem valor e origem preenchida ${quoteSnippet(origin)}.`
  if (!originMiddle && !targetMiddle) return ''

  const extraOrigin = originMiddle && !targetMiddle
  const extraTarget = targetMiddle && !originMiddle
  const counts = countPhrase(originLength, targetLength)

  if (extraTarget) {
    const extraCount = charsOf(targetMiddle).length
    const extra = `destino possui ${extraCount} ${extraWord(extraCount)} ${quoteSnippet(targetMiddle)}`
    if (extraAtEnd) return `${counts}; ${extra}.`
    return `${counts}; ${extra} na posição ${firstDiffIndex}.`
  }

  if (extraOrigin) {
    const extraCount = charsOf(originMiddle).length
    const extra = `origem possui ${extraCount} ${extraWord(extraCount)} ${quoteSnippet(originMiddle)}`
    if (extraAtEnd) return `${counts}; ${extra}.`
    return `${counts}; ${extra} na posição ${firstDiffIndex}.`
  }

  const compactValues = originLength <= 24 && targetLength <= 24
  const originSnippet = compactValues ? origin : originMiddle
  const targetSnippet = compactValues ? target : targetMiddle
  const sameLength = originLength === targetLength
  const singleSubstitution = sameLength && charsOf(originMiddle).length === 1 && charsOf(targetMiddle).length === 1

  if (singleSubstitution) {
    return `${counts}, mas há substituição de caracteres na posição ${firstDiffIndex}: origem ${quoteSnippet(originMiddle)} x destino ${quoteSnippet(targetMiddle)}.`
  }

  if (sameLength) {
    return `${counts}, mas há divergência no conteúdo: origem ${quoteSnippet(originSnippet)} x destino ${quoteSnippet(targetSnippet)}.`
  }

  return `${counts}; trecho divergente: origem ${quoteSnippet(originSnippet)} x destino ${quoteSnippet(targetSnippet)}.`
}

export const describeStringDifference = (origin: string, target: string): StringDifference => {
  const originText = origin ?? ''
  const targetText = target ?? ''
  const aligned = alignDifference(originText, targetText)
  const extraCharsOrigin = aligned.originMiddle && !aligned.targetMiddle ? aligned.originMiddle : ''
  const extraCharsTarget = aligned.targetMiddle && !aligned.originMiddle ? aligned.targetMiddle : ''
  const compactValues = aligned.originLength <= 24 && aligned.targetLength <= 24
  const originSnippet = extraCharsOrigin
    || (compactValues && aligned.originMiddle && aligned.targetMiddle ? originText : aligned.originMiddle)
  const targetSnippet = extraCharsTarget
    || (compactValues && aligned.originMiddle && aligned.targetMiddle ? targetText : aligned.targetMiddle)

  return {
    sameLength: aligned.originLength === aligned.targetLength,
    originLength: aligned.originLength,
    targetLength: aligned.targetLength,
    extraInOrigin: Boolean(extraCharsOrigin),
    extraInTarget: Boolean(extraCharsTarget),
    extraCharsOrigin,
    extraCharsTarget,
    firstDiffIndex: aligned.firstDiffIndex,
    originSnippet,
    targetSnippet,
    reasonText: buildReasonText(originText, targetText, aligned),
  }
}

export const buildDifferenceReason = (prefix: string, origin: string, target: string) => {
  const { reasonText } = describeStringDifference(origin, target)
  if (!reasonText) return prefix.trim()
  if (!prefix.trim()) return reasonText
  const head = prefix.trim()
  return head.endsWith('.') ? `${head} ${reasonText}` : `${head}. ${reasonText}`
}
