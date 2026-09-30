const calculateCheckDigit = (payload) => {
  let sum = 0
  let weight = 3
  for (let index = payload.length - 1; index >= 0; index -= 1) {
    sum += Number(payload[index]) * weight
    weight = weight === 3 ? 1 : 3
  }
  return (10 - (sum % 10)) % 10
}

const cases = [
  ['7894900011517', 13],
  ['4006381333931', 13],
  ['96385074', 8],
  ['036000291452', 12],
]

for (const [code, length] of cases) {
  if (code.length !== length) throw new Error(`Tamanho inválido no fixture ${code}`)
  const expected = Number(code.at(-1))
  const actual = calculateCheckDigit(code.slice(0, -1))
  if (actual !== expected) throw new Error(`DV incorreto para ${code}: esperado ${expected}, obtido ${actual}`)
}

for (const length of [8, 12, 13]) {
  const short = '123'
  const normalized = short.padStart(length, '0')
  if (normalized.length !== length || !normalized.endsWith(short)) {
    throw new Error(`Padding à esquerda falhou para ${length} posições`)
  }
}

console.log('PASS: EAN-8, UPC-A/EAN-12, EAN-13 e zero à esquerda validados.')
