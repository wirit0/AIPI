export interface ZoneCoord {
  id: string
  name: string
  lat: number
  lng: number
}

export const ZONE_COORDS: ZoneCoord[] = [
  { id: "z1", name: "La Ligua",      lat: -32.45, lng: -71.23 },
  { id: "z2", name: "Petorca",       lat: -32.25, lng: -70.93 },
  { id: "z3", name: "Viña del Mar",  lat: -33.02, lng: -71.55 },
  { id: "z4", name: "Valparaíso",    lat: -33.05, lng: -71.62 },
  { id: "z5", name: "Quilpué",       lat: -33.05, lng: -71.44 },
  { id: "z6", name: "Villa Alemana", lat: -33.04, lng: -71.37 },
  { id: "z7", name: "Casablanca",    lat: -33.32, lng: -71.41 },
  { id: "z8", name: "San Antonio",   lat: -33.58, lng: -71.61 },
]
