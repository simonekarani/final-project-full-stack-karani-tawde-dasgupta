import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng)
    }
  })

  return null
}

export default function TripMap({ destination, attractions, activities, onMarkerClick }) {
  const defaultCenter = destination?.coordinates || [40.7128, -74.0060]

  return (
    <div style={{ height: '500px', width: '100%' }}>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        />

        <MapClickHandler
          onMapClick={(latlng) => {
            console.log('map clicked at:', latlng)
          }}
        />

        {destination && (
          <Marker position={destination.coordinates}>
            <Popup>
              <div>
                <h3>{destination.name}</h3>
                <p>main destination</p>
              </div>
            </Popup>
          </Marker>
        )}

        {attractions.map((attraction) => (
          <Marker
            key={attraction.id}
            position={attraction.coordinates}
            eventHandlers={{
              click: () => onMarkerClick(attraction)
            }}
          >
            <Popup>
              <div>
                <h3>{attraction.name}</h3>
                <p>{attraction.location}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {activities.map((activity) => (
          <Marker
            key={activity.id}
            position={activity.coordinates}
            eventHandlers={{
              click: () => onMarkerClick(activity)
            }}
          >
            <Popup>
              <div>
                <h3>{activity.name}</h3>
                <p>{activity.location}</p>
                <p>{activity.date}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}