import { useState } from 'react'
import TripMap from '../components/TripMap'

export default function MapPage() {
  const [selectedItem, setSelectedItem] = useState(null)

  const destination = {
    name: 'Paris',
    coordinates: [48.8566, 2.3522]
  }

  const attractions = [
    {
      id: 1,
      name: 'Eiffel Tower',
      location: 'Paris',
      coordinates: [48.8584, 2.2945]
    },
    {
      id: 2,
      name: 'Louvre Museum',
      location: 'Paris',
      coordinates: [48.8606, 2.3376]
    }
  ]

  const activities = [
    {
      id: 1,
      name: 'Dinner Cruise',
      location: 'Seine River',
      date: '2026-06-11',
      coordinates: [48.8610, 2.3000],
      notes: 'evening booking'
    },
    {
      id: 2,
      name: 'Walking Tour',
      location: 'Montmartre',
      date: '2026-06-12',
      coordinates: [48.8867, 2.3431],
      notes: 'morning activity'
    }
  ]

  return (
    <div>
      <h1>trip map</h1>

      <TripMap
        destination={destination}
        attractions={attractions}
        activities={activities}
        onMarkerClick={setSelectedItem}
      />

      {selectedItem && (
        <div style={{ marginTop: '20px' }}>
          <h2>selected details</h2>
          <p><strong>name:</strong> {selectedItem.name}</p>
          <p><strong>location:</strong> {selectedItem.location}</p>
          {selectedItem.date && <p><strong>date:</strong> {selectedItem.date}</p>}
          {selectedItem.notes && <p><strong>notes:</strong> {selectedItem.notes}</p>}
        </div>
      )}
    </div>
  )
}