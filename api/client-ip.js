export default function handler(request, response) {
  const forwarded = request.headers['x-forwarded-for']
  const realIp = request.headers['x-real-ip']
  const socketIp = request.socket?.remoteAddress

  const candidate = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0]
      : Array.isArray(realIp)
        ? realIp[0]
        : realIp || socketIp || ''

  const ip = String(candidate || '').trim().replace(/^::ffff:/, '')

  response.setHeader('Cache-Control', 'no-store, max-age=0')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (!ip) {
    return response.status(503).json({ error: 'IP_UNAVAILABLE' })
  }

  return response.status(200).json({ ip })
}
