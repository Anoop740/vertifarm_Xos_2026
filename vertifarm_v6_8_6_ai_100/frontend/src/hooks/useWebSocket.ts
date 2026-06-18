import { useEffect, useRef, useState, useCallback } from 'react'

export interface SensorData {
  zone_id: string
  temperature: number
  humidity: number
  co2: number
  ph: number
  ec: number
  ppfd: number
  timestamp: string
}

type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export function useSensorWebSocket(zoneId: string | null, enabled = true) {
  const [data,   setData]   = useState<SensorData | null>(null)
  const [status, setStatus] = useState<WsStatus>('disconnected')
  const wsRef    = useRef<WebSocket | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout>>()
  const retries  = useRef(0)

  const connect = useCallback(() => {
    if (!zoneId || !enabled) return
    const base = (import.meta.env.VITE_WS_URL || '').replace(/^http/, 'ws') ||
      `ws://${window.location.hostname}:8000`
    const url  = `${base}/api/v1/ws/sensors/${zoneId}`
    setStatus('connecting')
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onopen    = () => { setStatus('connected'); retries.current = 0 }
    ws.onmessage = (e) => { try { setData(JSON.parse(e.data)) } catch {} }
    ws.onerror   = () => setStatus('error')
    ws.onclose   = () => {
      setStatus('disconnected')
      const delay = Math.min(1000 * Math.pow(2, retries.current++), 30000)
      retryRef.current = setTimeout(connect, delay)
    }
  }, [zoneId, enabled])

  useEffect(() => {
    connect()
    return () => { clearTimeout(retryRef.current); wsRef.current?.close() }
  }, [connect])

  return { data, status }
}

export function useMultiZoneWebSocket(zoneIds: string[], enabled = true) {
  const [readings, setReadings] = useState<Record<string, SensorData>>({})
  const [statuses, setStatuses] = useState<Record<string, WsStatus>>({})
  const wsMap    = useRef<Record<string, WebSocket>>({})
  const retryMap = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    if (!enabled || !zoneIds.length) return
    const base = (import.meta.env.VITE_WS_URL || '').replace(/^http/, 'ws') ||
      `ws://${window.location.hostname}:8000`

    function connectZone(zid: string, attempt = 0) {
      const ws = new WebSocket(`${base}/api/v1/ws/sensors/${zid}`)
      wsMap.current[zid] = ws
      setStatuses(s => ({ ...s, [zid]: 'connecting' }))
      ws.onopen    = () => setStatuses(s => ({ ...s, [zid]: 'connected' }))
      ws.onmessage = (e) => {
        try { const d = JSON.parse(e.data); setReadings(r => ({ ...r, [zid]: d })) } catch {}
      }
      ws.onerror = () => setStatuses(s => ({ ...s, [zid]: 'error' }))
      ws.onclose = () => {
        setStatuses(s => ({ ...s, [zid]: 'disconnected' }))
        retryMap.current[zid] = setTimeout(() => connectZone(zid, attempt+1),
          Math.min(1000 * Math.pow(2, attempt), 30000))
      }
    }
    zoneIds.forEach(id => connectZone(id))
    return () => {
      Object.values(wsMap.current).forEach(w => w.close())
      Object.values(retryMap.current).forEach(t => clearTimeout(t))
    }
  }, [zoneIds.join(','), enabled])

  return { readings, statuses }
}
