import type { GeoResult } from '../types'

interface NominatimItem {
  display_name: string
  lat: string
  lon: string
  address?: Record<string, string>
}

/** 地名查座標（OpenStreetMap Nominatim，免費、每秒最多 1 次查詢，只在使用者按下查詢時呼叫） */
export const geocodeRepo = {
  async search(q: string): Promise<GeoResult[]> {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', '5')
    url.searchParams.set('accept-language', 'zh-TW,zh,en')
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`地點查詢失敗（${res.status}）`)
    const items = (await res.json()) as NominatimItem[]
    return items.map((it) => {
      const a = it.address ?? {}
      return {
        label: it.display_name,
        city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? a.state ?? null,
        country: a.country ?? null,
        latitude: Number(it.lat),
        longitude: Number(it.lon),
      }
    })
  },
}
