// use react hooks for state memoized values and side effects
import { useEffect, useMemo, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import destinationOptions from '../data/destinationOptions.json'

// reset leaflet icon lookup so the marker images work correctly in vite
delete L.Icon.Default.prototype._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

// helper component so we can listen for map clicks
function MapClickHandler() {
  useMapEvents({
    click(e) {
      console.log('map clicked at', e.latlng)
    },
  })

  return null
}

// helper component that keeps the map view fitted around all points
function FitBounds({ points }) {
  const map = useMap()

  useEffect(() => {
    if (!points || points.length === 0) return

    if (points.length === 1) {
      map.setView(points[0], 14)
      return
    }

    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [map, points])

  return null
}

// convert a typed place name or address into latitude and longitude
async function geocodePlace(placeText) {
  if (!placeText || !placeText.trim()) {
    return null
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeText)}&limit=1`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    )

    const data = await response.json()

    if (!Array.isArray(data) || data.length === 0) {
      return null
    }

    return [Number(data[0].lat), Number(data[0].lon)]
  } catch (err) {
    console.error('geocoding failed for:', placeText, err)
    return null
  }
}

// slightly offset duplicate coordinates so markers do not sit exactly on top of each other
function addSmallOffsetIfDuplicate(coords, usedMap) {
  const key = `${coords[0].toFixed(6)},${coords[1].toFixed(6)}`
  const count = usedMap[key] || 0
  usedMap[key] = count + 1

  if (count === 0) {
    return coords
  }

  const offset = 0.00035 * count
  return [coords[0] + offset, coords[1] + offset]
}

// main trip map component used on the trip details page
export default function TripMap({ destination, attractions = [], activities = [], onMarkerClick }) {
  // store the main destination coordinates once they are found
  const [destinationCoords, setDestinationCoords] = useState(null)

  // store the final coordinates for each activity by id
  const [activityCoordsMap, setActivityCoordsMap] = useState({})

  // show a loading state while the destination center is still being resolved
  const [isMapLoading, setIsMapLoading] = useState(true)

  // show a smaller loading state while activity markers are updating
  const [isActivityLoading, setIsActivityLoading] = useState(true)

  // first try to match the destination against the saved dataset
  const destinationMatch = useMemo(() => {
    if (!destination?.name) return null

    return destinationOptions.find(
      (item) => item.destination?.toLowerCase() === destination.name.toLowerCase()
    )
  }, [destination?.name])

  // resolve the main destination coordinates from props dataset values or geocoding
  useEffect(() => {
    let isMounted = true

    async function loadDestinationCoords() {
      setIsMapLoading(true)

      if (destination?.coordinates && Array.isArray(destination.coordinates)) {
        if (isMounted) {
          setDestinationCoords(destination.coordinates)
          setIsMapLoading(false)
        }
        return
      }

      if (destinationMatch?.latitude && destinationMatch?.longitude) {
        if (isMounted) {
          setDestinationCoords([destinationMatch.latitude, destinationMatch.longitude])
          setIsMapLoading(false)
        }
        return
      }

      const coords = await geocodePlace(destination?.name)

      if (isMounted) {
        setDestinationCoords(coords || [40.7128, -74.0060])
        setIsMapLoading(false)
      }
    }

    loadDestinationCoords()

    return () => {
      isMounted = false
    }
  }, [destination, destinationMatch])

  // resolve each activity location and build a marker map keyed by activity id
  useEffect(() => {
    let isMounted = true

    async function loadActivityCoords() {
      if (!destinationCoords) return

      setIsActivityLoading(true)

      const nextCoords = {}
      const usedCoords = {}

      for (const activity of activities) {
        let coords = null

        if (activity.coordinates && Array.isArray(activity.coordinates)) {
          coords = activity.coordinates
        } else if (activity.latitude && activity.longitude) {
          coords = [Number(activity.latitude), Number(activity.longitude)]
        } else {
          const locationText = activity.location || activity.name
          coords = await geocodePlace(locationText)
        }

        if (!coords) {
          coords = destinationCoords
        }

        nextCoords[activity.id] = addSmallOffsetIfDuplicate(coords, usedCoords)
      }

      if (isMounted) {
        setActivityCoordsMap(nextCoords)
        setIsActivityLoading(false)
      }
    }

    loadActivityCoords()

    return () => {
      isMounted = false
    }
  }, [activities, destinationCoords])

  // gather attraction points that already came in with coordinates
  const attractionPoints = attractions
    .map((attraction) => attraction.coordinates)
    .filter(Boolean)

  // gather activity points after they have been looked up
  const activityPoints = activities
    .map((activity) => activityCoordsMap[activity.id])
    .filter(Boolean)

  // combine all visible points so the map can fit around them
  const allPoints = destinationCoords
    ? [destinationCoords, ...attractionPoints, ...activityPoints]
    : []

  // wait until the destination center is ready before rendering the map
  if (!destinationCoords || isMapLoading) {
    return (
      <div className="trip-map-wrapper">
        <div
          className="trip-map"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '600',
            color: '#4f6a63',
          }}
        >
          loading map...
        </div>
      </div>
    )
  }

  return (
    <div className="trip-map-wrapper">
      {isActivityLoading && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.65rem 0.9rem',
            borderRadius: '10px',
            background: '#eef4f1',
            border: '1px solid #d8e5df',
            color: '#48625b',
            fontWeight: '600',
          }}
        >
          updating map...
        </div>
      )}

      <MapContainer
        center={destinationCoords}
        zoom={13}
        scrollWheelZoom={true}
        className="trip-map"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler />
        <FitBounds points={allPoints} />

        <CircleMarker
          center={destinationCoords}
          radius={10}
          pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.7 }}
        >
          <Popup>
            <div>
              <strong>{destination?.name || 'Destination'}</strong>
              <p>main destination</p>
            </div>
          </Popup>
        </CircleMarker>

        {attractions.map((attraction) => {
          const coords = attraction.coordinates || destinationCoords

          return (
            <Marker
              key={`attraction-${attraction.id}`}
              position={coords}
              eventHandlers={{
                click: () => onMarkerClick?.(attraction),
              }}
            >
              <Popup>
                <div>
                  <strong>{attraction.name}</strong>
                  <p>{attraction.location}</p>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {activities.map((activity) => {
          const coords = activityCoordsMap[activity.id] || destinationCoords

          return (
            <Marker
              key={`activity-${activity.id}`}
              position={coords}
              eventHandlers={{
                click: () => onMarkerClick?.(activity),
              }}
            >
              <Popup>
                <div>
                  <strong>{activity.name}</strong>
                  <p>{activity.location}</p>
                  {activity.date && <p>{activity.date}</p>}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}