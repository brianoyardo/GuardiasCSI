import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Polyline,
  useMap,
} from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'

const defaultCenter = [-16.5, -68.15]

const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const completedIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  iconRetinaUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function RecenterMap({ center }) {
  const map = useMap()

  useEffect(() => {
    if (center) {
      map.setView(center, 16)
    }
  }, [center, map])

  return null
}

export default function MapView({
  userPosition,
  checkpoints = [],
  completedCheckpointIds = [],
}) {
  const center = userPosition
    ? [userPosition.lat, userPosition.lng]
    : defaultCenter

  const polylinePoints = checkpoints.map((point) => [point.lat, point.lng])

  return (
    <MapContainer
      center={center}
      zoom={16}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
      />

      <RecenterMap center={center} />

      {polylinePoints.length > 1 && (
        <Polyline positions={polylinePoints} />
      )}

      {userPosition && (
        <CircleMarker center={[userPosition.lat, userPosition.lng]} radius={10}>
          <Popup>Ubicación actual del guardia</Popup>
        </CircleMarker>
      )}

      {checkpoints.map((point) => {
        const isCompleted = completedCheckpointIds.includes(point.id)

        return (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={isCompleted ? completedIcon : defaultIcon}
          >
            <Popup>
              <strong>{point.name}</strong>
              <br />
              Orden: {point.order}
              <br />
              Estado: {isCompleted ? 'Completado' : 'Pendiente'}
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}