import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useColorTags } from '@/data/hooks'
import type { Project } from '@/data/types'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** 世界地圖：Leaflet + OpenStreetMap；標記顏色＝專案顏色標籤，點開可進入專案 */
export function ProjectMap({ projects }: { projects: Project[] }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const nav = useNavigate()
  const { data: tags = [] } = useColorTags()

  useEffect(() => {
    if (!el.current || map.current) return
    map.current = L.map(el.current, { worldCopyJump: true, zoomControl: true, attributionControl: true }).setView([23.7, 121], 3)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      className: 'map-tiles',
    }).addTo(map.current)
    map.current.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')
    layer.current = L.layerGroup().addTo(map.current)
    const onNav = (e: Event) => {
      const t = e.target as HTMLElement
      const id = t.closest<HTMLElement>('[data-project-id]')?.dataset.projectId
      if (id) nav(`/projects/${id}`)
    }
    el.current.addEventListener('click', onNav)
    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [nav])

  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const pts: L.LatLngExpression[] = []
    for (const p of projects) {
      if (p.latitude == null || p.longitude == null) continue
      const color = tags.find((t) => t.id === p.color_tag_id)?.color ?? tags.find((t) => t.is_default)?.color ?? '#8BE8CB'
      const ll: L.LatLngExpression = [p.latitude, p.longitude]
      pts.push(ll)
      L.circleMarker(ll, { radius: 9, color: '#1e2220', weight: 2, fillColor: color, fillOpacity: 1 })
        .bindPopup(
          `<div class="map-pop"><strong>${esc(p.name)}</strong><br/><span>${esc([p.city, p.country].filter(Boolean).join('・'))}</span><br/><button type="button" data-project-id="${p.id}">開啟專案 →</button></div>`,
        )
        .addTo(g)
    }
    if (pts.length === 1) m.setView(pts[0]!, 6)
    else if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 6 })
  }, [projects, tags])

  return <div ref={el} className="h-[min(640px,70dvh)] w-full overflow-hidden rounded-[var(--r-2xl)] border border-line" role="region" aria-label="專案世界地圖" />
}
