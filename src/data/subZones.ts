export interface SubZone {
  id: string
  name: string
  parentZoneId: string
  coords: [number, number][]
}

const subZones: SubZone[] = [
  // ===== z4 - Valparaíso =====
  {
    id: "z4_plan",
    name: "Valparaíso Plan",
    parentZoneId: "z4",
    coords: [
      [-33.046, -71.626],
      [-33.043, -71.612],
      [-33.051, -71.612],
      [-33.055, -71.626],
    ],
  },
  {
    id: "z4_cerros",
    name: "Cerros Alegre / Concepción",
    parentZoneId: "z4",
    coords: [
      [-33.040, -71.632],
      [-33.043, -71.624],
      [-33.053, -71.624],
      [-33.050, -71.634],
    ],
  },
  {
    id: "z4_placilla",
    name: "Placilla de Peñuelas",
    parentZoneId: "z4",
    coords: [
      [-33.088, -71.594],
      [-33.080, -71.570],
      [-33.068, -71.576],
      [-33.075, -71.600],
    ],
  },
  {
    id: "z4_laguna",
    name: "Laguna Verde",
    parentZoneId: "z4",
    coords: [
      [-33.098, -71.672],
      [-33.112, -71.682],
      [-33.115, -71.660],
      [-33.100, -71.655],
    ],
  },
  // ===== z3 - Viña del Mar =====
  {
    id: "z3_centro",
    name: "Viña del Mar Centro",
    parentZoneId: "z3",
    coords: [
      [-33.025, -71.552],
      [-33.025, -71.538],
      [-33.035, -71.538],
      [-33.035, -71.552],
    ],
  },
  {
    id: "z3_reaca",
    name: "Reñaca",
    parentZoneId: "z3",
    coords: [
      [-32.958, -71.542],
      [-32.958, -71.524],
      [-32.978, -71.524],
      [-32.978, -71.542],
    ],
  },
  {
    id: "z3_forestal",
    name: "Forestal / Miraflores",
    parentZoneId: "z3",
    coords: [
      [-33.022, -71.528],
      [-33.015, -71.518],
      [-33.022, -71.510],
      [-33.032, -71.522],
    ],
  },
  // ===== z5 - Quilpué =====
  {
    id: "z5_centro",
    name: "Quilpué Centro",
    parentZoneId: "z5",
    coords: [
      [-33.048, -71.448],
      [-33.045, -71.438],
      [-33.055, -71.438],
      [-33.058, -71.448],
    ],
  },
  {
    id: "z5_belloto",
    name: "El Belloto",
    parentZoneId: "z5",
    coords: [
      [-33.058, -71.420],
      [-33.050, -71.410],
      [-33.065, -71.405],
      [-33.070, -71.420],
    ],
  },
  // ===== z6 - Villa Alemana =====
  {
    id: "z6_centro",
    name: "Villa Alemana Centro",
    parentZoneId: "z6",
    coords: [
      [-33.042, -71.376],
      [-33.040, -71.366],
      [-33.048, -71.366],
      [-33.050, -71.376],
    ],
  },
  {
    id: "z6_peumo",
    name: "Peumo / Los Pinos",
    parentZoneId: "z6",
    coords: [
      [-33.038, -71.358],
      [-33.035, -71.348],
      [-33.045, -71.348],
      [-33.048, -71.358],
    ],
  },
  // ===== z1 - La Ligua =====
  {
    id: "z1_centro",
    name: "La Ligua Centro",
    parentZoneId: "z1",
    coords: [
      [-32.452, -71.234],
      [-32.448, -71.228],
      [-32.458, -71.226],
      [-32.460, -71.234],
    ],
  },
  {
    id: "z1_costa",
    name: "Los Molles / Pichidangui",
    parentZoneId: "z1",
    coords: [
      [-32.400, -71.380],
      [-32.390, -71.370],
      [-32.410, -71.360],
      [-32.420, -71.380],
    ],
  },
  // ===== z2 - Petorca =====
  {
    id: "z2_centro",
    name: "Petorca Centro",
    parentZoneId: "z2",
    coords: [
      [-32.252, -70.935],
      [-32.248, -70.928],
      [-32.258, -70.926],
      [-32.260, -70.935],
    ],
  },
  {
    id: "z2_chincolco",
    name: "Chincolco",
    parentZoneId: "z2",
    coords: [
      [-32.220, -70.960],
      [-32.215, -70.950],
      [-32.225, -70.948],
      [-32.230, -70.960],
    ],
  },
  // ===== z7 - Casablanca =====
  {
    id: "z7_centro",
    name: "Casablanca Centro",
    parentZoneId: "z7",
    coords: [
      [-33.322, -71.414],
      [-33.318, -71.406],
      [-33.328, -71.404],
      [-33.330, -71.414],
    ],
  },
  {
    id: "z7_quintay",
    name: "Laguna Verde / Quintay",
    parentZoneId: "z7",
    coords: [
      [-33.345, -71.480],
      [-33.350, -71.470],
      [-33.365, -71.475],
      [-33.360, -71.490],
    ],
  },
  // ===== z8 - San Antonio =====
  {
    id: "z8_centro",
    name: "San Antonio Centro",
    parentZoneId: "z8",
    coords: [
      [-33.582, -71.616],
      [-33.580, -71.608],
      [-33.588, -71.606],
      [-33.590, -71.616],
    ],
  },
  {
    id: "z8_llolleo",
    name: "Llolleo",
    parentZoneId: "z8",
    coords: [
      [-33.598, -71.600],
      [-33.595, -71.590],
      [-33.605, -71.588],
      [-33.610, -71.600],
    ],
  },
  {
    id: "z8_santo",
    name: "Santo Domingo",
    parentZoneId: "z8",
    coords: [
      [-33.630, -71.630],
      [-33.635, -71.620],
      [-33.650, -71.625],
      [-33.645, -71.640],
    ],
  },
]

export default subZones

export function getSubZonesByParent(parentId: string): SubZone[] {
  return subZones.filter((sz) => sz.parentZoneId === parentId)
}

export function getSubZone(id: string): SubZone | undefined {
  return subZones.find((sz) => sz.id === id)
}

export function subZoneCentroid(sz: SubZone): { lat: number; lng: number } {
  const sum = sz.coords.reduce(
    (acc, c) => ({ lat: acc.lat + c[0], lng: acc.lng + c[1] }),
    { lat: 0, lng: 0 },
  )
  return { lat: sum.lat / sz.coords.length, lng: sum.lng / sz.coords.length }
}
