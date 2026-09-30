import { toCanvas } from 'html-to-image'

const REPORT_SELECTOR = '.dup-print-report, .issue-print-report, .data-print-report'

type PdfOptions = {
  selector?: string
  filename?: string
}

const encoder = new TextEncoder()

function bytes(text: string) {
  return encoder.encode(text)
}

function concat(parts: Uint8Array[]) {
  const size = parts.reduce((total, part) => total + part.length, 0)
  const output = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function dataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = atob(base64)
  const output = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index)
  return output
}

function buildImagePdf(images: Array<{ data: Uint8Array; width: number; height: number }>) {
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 24
  const objects: Uint8Array[] = []
  const pageIds: number[] = []

  const catalogId = 1
  const pagesId = 2
  let nextId = 3

  for (const image of images) {
    const imageId = nextId++
    const contentId = nextId++
    const pageId = nextId++
    pageIds.push(pageId)

    const maxWidth = pageWidth - margin * 2
    const maxHeight = pageHeight - margin * 2
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height)
    const drawWidth = image.width * scale
    const drawHeight = image.height * scale
    const x = (pageWidth - drawWidth) / 2
    const y = pageHeight - margin - drawHeight
    const content = `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`
    const contentBytes = bytes(content)

    objects[imageId] = concat([
      bytes(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>\nstream\n`),
      image.data,
      bytes('\nendstream'),
    ])
    objects[contentId] = concat([
      bytes(`<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      bytes('endstream'),
    ])
    objects[pageId] = bytes(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    )
  }

  objects[catalogId] = bytes(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
  objects[pagesId] = bytes(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`)

  const header = bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  const parts: Uint8Array[] = [header]
  const offsets = new Array(nextId).fill(0)
  let offset = header.length

  for (let id = 1; id < nextId; id += 1) {
    const body = objects[id]
    const prefix = bytes(`${id} 0 obj\n`)
    const suffix = bytes('\nendobj\n')
    offsets[id] = offset
    parts.push(prefix, body, suffix)
    offset += prefix.length + body.length + suffix.length
  }

  const xrefOffset = offset
  let xref = `xref\n0 ${nextId}\n0000000000 65535 f \n`
  for (let id = 1; id < nextId; id += 1) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${nextId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  parts.push(bytes(xref))
  return new Blob(parts, { type: 'application/pdf' })
}

function safeFilename(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function findReport(selector?: string) {
  if (selector) return document.querySelector<HTMLElement>(selector)
  const reports = Array.from(document.querySelectorAll<HTMLElement>(REPORT_SELECTOR))
  return reports.reverse().find(node => node.textContent?.trim()) ?? null
}

export async function exportPrimeCheckPdf(options: PdfOptions = {}) {
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

  const source = findReport(options.selector)
  if (!source) throw new Error('Relatório não encontrado para geração do PDF.')

  const stage = document.createElement('div')
  stage.className = 'primecheck-pdf-stage'
  const clone = source.cloneNode(true) as HTMLElement
  clone.removeAttribute('aria-hidden')
  clone.style.display = 'block'
  clone.style.position = 'static'
  clone.style.width = '1120px'
  clone.style.maxWidth = '1120px'
  clone.style.height = 'auto'
  stage.appendChild(clone)
  document.body.appendChild(stage)

  try {
    const canvas = await toCanvas(clone, {
      pixelRatio: 1.6,
      backgroundColor: '#ffffff',
      cacheBust: true,
    })

    const pageAspect = 547.28 / 793.89
    const sliceHeight = Math.max(1, Math.floor(canvas.width / pageAspect))
    const pages: Array<{ data: Uint8Array; width: number; height: number }> = []

    for (let top = 0; top < canvas.height; top += sliceHeight) {
      const height = Math.min(sliceHeight, canvas.height - top)
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = height
      const context = pageCanvas.getContext('2d')
      if (!context) throw new Error('Não foi possível preparar uma página do PDF.')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      context.drawImage(canvas, 0, top, canvas.width, height, 0, 0, canvas.width, height)
      pages.push({
        data: dataUrlBytes(pageCanvas.toDataURL('image/jpeg', 0.94)),
        width: pageCanvas.width,
        height: pageCanvas.height,
      })
    }

    const blob = buildImagePdf(pages)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const fallback = `primecheck-relatorio-${new Date().toISOString().slice(0, 10)}`
    anchor.href = url
    anchor.download = `${safeFilename(options.filename || fallback)}.pdf`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  } finally {
    stage.remove()
  }
}
