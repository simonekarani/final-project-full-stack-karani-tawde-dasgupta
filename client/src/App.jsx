import { useMemo, useState } from 'react';
import axios from 'axios';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { travelApi } from './api.js';
import './App.css';

const DESTINATIONS = [
  { id: 1, city: 'Kyoto', country: 'Japan', description: 'Temples, tea houses, and spring blossoms.', image: 'https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=900&q=80' },
  { id: 2, city: 'Lisbon', country: 'Portugal', description: 'Colorful streets, coastal views, and tram rides.', image: 'https://images.unsplash.com/photo-1513735492246-483525079686?auto=format&fit=crop&w=900&q=80' },
  { id: 3, city: 'Vancouver', country: 'Canada', description: 'Mountains, parks, and waterfront walks.', image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=900&q=80' },
  { id: 4, city: 'Cape Town', country: 'South Africa', description: 'Scenic coastlines and iconic hikes.', image: 'https://images.unsplash.com/photo-1576485290814-1c72aa4bbb8e?auto=format&fit=crop&w=900&q=80' },
];

const INITIAL_TRIPS = [
  {
    id: 101,
    destination: 'Kyoto, Japan',
    startDate: '2026-05-10',
    endDate: '2026-05-16',
    notes: 'Book tea ceremony by day 2.',
    activities: [
      { id: 1, name: 'Fushimi Inari Shrine', location: 'Kyoto', date: '2026-05-11', notes: 'Go early morning for fewer crowds.' },
      { id: 2, name: 'Arashiyama Bamboo Grove', location: 'Kyoto', date: '2026-05-12', notes: 'Pair with monkey park visit.' },
    ],
  },
];

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DESTINATION_COORDS = {
  'Kyoto, Japan': [35.0116, 135.7681],
  'Lisbon, Portugal': [38.7223, -9.1393],
  'Vancouver, Canada': [49.2827, -123.1207],
  'Cape Town, South Africa': [-33.9249, 18.4241],
  'Paris': [48.8566, 2.3522],
  'Tokyo': [35.6762, 139.6503],
};

const ACTIVITY_COORDS = {
  'Fushimi Inari Shrine': [34.9671, 135.7727],
  'Arashiyama Bamboo Grove': [35.0170, 135.6713],
  'Eiffel Tower Visit': [48.8584, 2.2945],
  'Louvre Museum': [48.8606, 2.3376],
  'Shibuya Crossing': [35.6595, 139.7005],
};

function getDestinationCoords(destination) {
  return DESTINATION_COORDS[destination] || [40.7128, -74.0060];
}

function getActivityCoords(activity, tripDestination) {
  return ACTIVITY_COORDS[activity.name] || getDestinationCoords(tripDestination);
}

function MapClickHandler() {
  useMapEvents({
    click(e) {
      console.log('map clicked at', e.latlng);
    },
  });

  return null;
}

function TripMap({ trip, selectedActivity, onSelectActivity }) {
  const center = getDestinationCoords(trip.destination);

  return (
    <div className="trip-map-wrapper">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={true}
        className="trip-map"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler />

        <Marker position={center}>
          <Popup>
            <div>
              <strong>{trip.destination}</strong>
              <p>main destination</p>
            </div>
          </Popup>
        </Marker>

        {trip.activities.map((activity) => (
          <Marker
            key={activity.id}
            position={getActivityCoords(activity, trip.destination)}
            eventHandlers={{
              click: () => onSelectActivity(activity),
            }}
          >
            <Popup>
              <div>
                <strong>{activity.name}</strong>
                <p>{activity.location}</p>
                <p>{activity.date}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {selectedActivity && (
        <div className="map-details-card">
          <h3>selected activity</h3>
          <p><strong>name:</strong> {selectedActivity.name}</p>
          <p><strong>location:</strong> {selectedActivity.location}</p>
          <p><strong>date:</strong> {selectedActivity.date}</p>
          {selectedActivity.notes && <p><strong>notes:</strong> {selectedActivity.notes}</p>}
        </div>
      )}
    </div>
  );
}

function HomePage({ isMember, onSaveItinerary, member }) {
  const [saving, setSaving] = useState(null);

  const handleSaveItinerary = async (destination) => {
    setSaving(destination.id);
    try {
      const response = await travelApi.createTrip({
        user_id: member?.id,
        destination: `${destination.city}, ${destination.country}`,
        start_date: '2026-06-01',
        end_date: '2026-06-05',
        notes: `Saved from destination card for ${destination.city}.`
      });

      const newTrip = {
        id: response.data.id,
        destination: `${destination.city}, ${destination.country}`,
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        notes: `Saved from destination card for ${destination.city}.`,
        activities: [],
      };
      onSaveItinerary(newTrip);
    } catch (err) {
      alert('Failed to save itinerary. Please try again.');
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  return (
    <section>
      <div className="hero">
        <h1>Plan meaningful trips with less stress.</h1>
        <p>Browse destinations, curate activities, and keep your itinerary organized in one calm workspace.</p>
      </div>
      <div className="card-grid">
        {DESTINATIONS.map((destination) => (
          <article className="destination-card" key={destination.id}>
            <img src={destination.image} alt={`${destination.city} skyline`} />
            <div className="destination-content">
              <h3>{destination.city}, {destination.country}</h3>
              <p>{destination.description}</p>
              {isMember ? (
                <button onClick={() => handleSaveItinerary(destination)} disabled={saving === destination.id}>
                  {saving === destination.id ? 'Saving...' : 'Save itinerary'}
                </button>
              ) : (
                <Link to="/auth" className="small-link">Login to save itinerary</Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AuthPage({ onAuthSuccess }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    
    try {
      if (mode === 'signup') {
        if (form.password !== form.confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        const response = await travelApi.signup({ email: form.email, password: form.password });
        onAuthSuccess(response.data);
      } else {
        const response = await travelApi.login({ email: form.email, password: form.password });
        onAuthSuccess(response.data);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please try again.');
    }
  };

  return (
    <section className="auth-panel">
      <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={onSubmit}>
        <label>Email</label>
        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label>Password</label>
        <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {mode === 'signup' && (
          <>
            <label>Confirm Password</label>
            <input type="password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
          </>
        )}
        <button type="submit">{mode === 'login' ? 'Login' : 'Sign up'}</button>
      </form>
      <button className="ghost-btn" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Login'}
      </button>
    </section>
  );
}



function DashboardPage({ trips, memberEmail }) {
  return (
    <section>
      <h2>Your dashboard</h2>
      <p className="muted-text">Signed in as {memberEmail}</p>
      <div className="list-stack">
        {trips.map((trip) => (
          <Link className="trip-row" to={`/trips/${trip.id}`} key={trip.id}>
            <div>
              <h3>{trip.destination}</h3>
              <p>{trip.startDate} to {trip.endDate}</p>
            </div>
            <span>{trip.activities.length} activities</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TripDetailsPage({ trips, onAddActivity, onRemoveActivity }) {
  const { tripId } = useParams();
  const trip = trips.find((item) => String(item.id) === tripId);
  const [activity, setActivity] = useState({ name: '', location: '', date: '', notes: '' });
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [recCategory, setRecCategory] = useState('cafes');

  if (!trip) {
    return <Navigate to="/dashboard" replace />;
  }

  const getRecs = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await travelApi.getRecommendations(recCategory, trip.destination);
      setRecommendations(response.data);
    } catch (err) {
      setError('Could not fetch recommendations.');
    } finally {
      setLoading(false);
    }
  };

  const submitActivity = async (event) => {
    event.preventDefault();
    if (!activity.name || !activity.location || !activity.date) return;

    setLoading(true);
    setError('');
    try {
      const response = await travelApi.addActivity(trip.id, activity);
      onAddActivity(trip.id, response.data.activity);
      setActivity({ name: '', location: '', date: '', notes: '' });
    } catch (err) {
      setError('Failed to add activity. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveActivity = async (activityId) => {
    setLoading(true);
    setError('');
    try {
      await travelApi.removeActivity(activityId);
      onRemoveActivity(trip.id, activityId);
    } catch (err) {
      setError('Failed to remove activity. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="split-layout">
      <div>
        <h2>{trip.destination}</h2>
        <p className="muted-text">{trip.startDate} - {trip.endDate}</p>
        <p>{trip.notes}</p>

        <div className="recommendations-box">
          <h3>Discover {trip.destination}</h3>
          <div className="rec-controls">
            <select value={recCategory} onChange={(e) => setRecCategory(e.target.value)}>
              <option value="museums">Museums</option>
              <option value="cafes">Coffee Shops</option>
              <option value="parks">Parks</option>
              <option value="restaurants">Restaurants</option>
            </select>
            <button onClick={getRecs} disabled={loading}>Search</button>
          </div>

          <div className="rec-list">
            {recommendations.map((rec) => (
              <div key={rec.id} className="rec-item">
                <div>
                  <strong>{rec.name}</strong>
                  <p>{rec.address} • ⭐ {rec.rating}</p>
                </div>
                <button
                  className="small-btn"
                  onClick={() =>
                    setActivity({
                      name: rec.name,
                      location: rec.address,
                      date: trip.startDate,
                      notes: 'Recommended via Google'
                    })
                  }
                >
                  Use this
                </button>
              </div>
            ))}
          </div>
        </div>

        <TripMap
          trip={trip}
          selectedActivity={selectedActivity}
          onSelectActivity={setSelectedActivity}
        />

        <div className="list-stack">
          {trip.activities.map((item) => (
            <article className="activity-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.location} • {item.date}</p>
                {item.notes && <small>{item.notes}</small>}
              </div>
              <button
                className="danger-btn"
                onClick={() => handleRemoveActivity(item.id)}
                disabled={loading}
              >
                Remove
              </button>
            </article>
          ))}
        </div>
      </div>

      <aside className="form-card">
        <h3>Add Activity</h3>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <form onSubmit={submitActivity}>
          <label>Name</label>
          <input value={activity.name} onChange={(e) => setActivity({ ...activity, name: e.target.value })} />
          <label>Location</label>
          <input value={activity.location} onChange={(e) => setActivity({ ...activity, location: e.target.value })} />
          <label>Date</label>
          <input type="date" value={activity.date} onChange={(e) => setActivity({ ...activity, date: e.target.value })} />
          <label>Notes</label>
          <textarea value={activity.notes} onChange={(e) => setActivity({ ...activity, notes: e.target.value })} rows="3" />
          <button type="submit" disabled={loading}>
            {loading ? 'Adding...' : 'Add activity'}
          </button>
        </form>
      </aside>
    </section>
  );
}

function TripFormPage({ trips, onSaveTrip, member }) {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const editingTrip = trips.find((item) => String(item.id) === tripId);
  const [form, setForm] = useState(
    editingTrip || { destination: '', startDate: '', endDate: '', notes: '', activities: [] }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (editingTrip) {
        await travelApi.updateTrip(editingTrip.id, {
          destination: form.destination,
          start_date: form.startDate,
          end_date: form.endDate,
          notes: form.notes
        });
        onSaveTrip({ ...form, id: editingTrip?.id });
      } else {
        const response = await travelApi.createTrip({
          user_id: member?.id,
          destination: form.destination,
          start_date: form.startDate,
          end_date: form.endDate,
          notes: form.notes
        });
        onSaveTrip({ ...form, id: response.data.id });
      }
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to save trip. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="form-card">
      <h2>{editingTrip ? 'Edit trip' : 'Create trip'}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={onSubmit}>
        <label>Destination</label>
        <input required value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
        <label>Start date</label>
        <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        <label>End date</label>
        <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        <label>Trip notes</label>
        <textarea rows="4" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button type="submit" disabled={loading}>{loading ? 'Saving...' : (editingTrip ? 'Update trip' : 'Create trip')}</button>
      </form>
    </section>
  );
}

function ProtectedRoute({ isMember, children }) {
  if (!isMember) return <Navigate to="/auth" replace />;
  return children;
}

function App() {
  const [member, setMember] = useState(null);
  const [trips, setTrips] = useState(INITIAL_TRIPS);
  const memberEmail = useMemo(() => member?.email || 'member@example.com', [member]);

  const saveItinerary = (newTrip) => {
    setTrips((current) => [newTrip, ...current]);
  };

  const addActivity = (tripId, activity) => {
    setTrips((current) =>
      current.map((trip) =>
        trip.id === tripId
          ? { ...trip, activities: [...trip.activities, activity] }
          : trip
      )
    );
  };

  const removeActivity = (tripId, activityId) => {
    setTrips((current) =>
      current.map((trip) =>
        trip.id === tripId
          ? { ...trip, activities: trip.activities.filter((activity) => activity.id !== activityId) }
          : trip
      )
    );
  };

  const saveTrip = (trip) => {
    setTrips((current) => {
      const existing = current.find(item => item.id === trip.id);
      if (existing) {
        // Update existing trip
        return current.map((item) => (item.id === trip.id ? { ...item, ...trip } : item));
      } else {
        // Add new trip (from form creation)
        return [{ ...trip, activities: [] }, ...current];
      }
    });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">Travel Planner</Link>
        <nav className="nav-links">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/trips/new">Create Trip</NavLink>
          {!member ? (
            <NavLink to="/auth">Login / Signup</NavLink>
          ) : (
            <button className="ghost-btn" onClick={() => setMember(null)}>Logout</button>
          )}
        </nav>
      </header>

      <main className="page-content">
        <Routes>
          <Route path="/" element={<HomePage isMember={Boolean(member)} onSaveItinerary={saveItinerary} member={member} />} />
          <Route path="/auth" element={<AuthPage onAuthSuccess={setMember} />} />
          <Route
            path="/dashboard"
            element={(
              <ProtectedRoute isMember={Boolean(member)}>
                <DashboardPage trips={trips} memberEmail={memberEmail} />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/trips/new"
            element={(
              <ProtectedRoute isMember={Boolean(member)}>
                <TripFormPage trips={trips} onSaveTrip={saveTrip} member={member} />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/trips/edit/:tripId"
            element={(
              <ProtectedRoute isMember={Boolean(member)}>
                <TripFormPage trips={trips} onSaveTrip={saveTrip} member={member} />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/trips/:tripId"
            element={(
              <ProtectedRoute isMember={Boolean(member)}>
                <TripDetailsPage trips={trips} onAddActivity={addActivity} onRemoveActivity={removeActivity} />
              </ProtectedRoute>
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
