// use react hooks for state memoized values and syncing with the backend
import { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { travelApi } from './api.js';
import datasetDestinationOptions from './data/destinationOptions.json';
import './App.css';
import TripDetailsPage from './pages/TripDetailsPage';

// destination card data used on the home page
const DESTINATIONS = datasetDestinationOptions;

// start with no local trips and then load the signed in users trips from the backend
const INITIAL_TRIPS = [];

// fallback coordinates for a few known destinations used by the older map helpers
const DESTINATION_COORDS = {
  'Kyoto, Japan': [35.0116, 135.7681],
  'Lisbon, Portugal': [38.7223, -9.1393],
  'Vancouver, Canada': [49.2827, -123.1207],
  'Cape Town, South Africa': [-33.9249, 18.4241],
  'Paris': [48.8566, 2.3522],
};

// build a single dropdown list of allowed destinations for the trip form
const DESTINATION_OPTIONS = Array.from(
  new Set([
    ...datasetDestinationOptions.map((destination) => destination.destination),
    ...DESTINATIONS.map((destination) => `${destination.city}, ${destination.country}`),
    ...Object.keys(DESTINATION_COORDS),
  ])
).sort();

// reset leaflet icon lookup so marker images work in vite
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const ACTIVITY_COORDS = {
  'Fushimi Inari Shrine': [34.9671, 135.7727],
  'Arashiyama Bamboo Grove': [35.0170, 135.6713],
  'Eiffel Tower Visit': [48.8584, 2.2945],
  'Louvre Museum': [48.8606, 2.3376],
  'Shibuya Crossing': [35.6595, 139.7005],
};

// older helper that returns fallback destination coordinates
function getDestinationCoords(destination) {
  return DESTINATION_COORDS[destination] || [40.7128, -74.0060];
}

// older helper that returns fallback activity coordinates
function getActivityCoords(activity, tripDestination) {
  return ACTIVITY_COORDS[activity.name] || getDestinationCoords(tripDestination);
}

// older helper component for map click logging
function MapClickHandler() {
  useMapEvents({
    click(e) {
      console.log('map clicked at', e.latlng);
    },
  });

  return null;
}

// older map component still kept inside this file
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
          attribution="&copy; OpenStreetMap contributors"
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

// home page where users browse destinations and save a trip with selected dates
function HomePage({ isMember, onSaveItinerary, member }) {
  // track which destination card is currently being saved
  const [saving, setSaving] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [tripDates, setTripDates] = useState({
    startDate: '',
    endDate: ''
  });

  const getUnsplashImage = (destination) =>
    `https://source.unsplash.com/900x600/?${encodeURIComponent(`${destination.city} ${destination.country} travel landmark`)}`;

  const getPicsumFallback = (destination) =>
    `https://picsum.photos/seed/${encodeURIComponent(destination.destination || `${destination.city}-${destination.country}`)}/900/600`;

  // open the date picker modal for the destination card the user clicked
  const openSaveModal = (destination) => {
    setSelectedDestination(destination);
    setTripDates({
      startDate: '',
      endDate: ''
    });
    setShowSaveModal(true);
  };

  const closeSaveModal = () => {
    setShowSaveModal(false);
    setSelectedDestination(null);
    setTripDates({
      startDate: '',
      endDate: ''
    });
  };

  // create the trip in the backend once the user picks valid dates
  const handleConfirmSave = async () => {
    if (!selectedDestination || !tripDates.startDate || !tripDates.endDate) {
      alert('Please select both start and end dates.');
      return;
    }

    if (tripDates.endDate < tripDates.startDate) {
      alert('End date cannot be before start date.');
      return;
    }

    setSaving(selectedDestination.id);

    try {
      const response = await travelApi.createTrip({
        user_id: member?.id,
        destination: `${selectedDestination.city}, ${selectedDestination.country}`,
        start_date: tripDates.startDate,
        end_date: tripDates.endDate,
        notes: `Saved from destination card for ${selectedDestination.city}.`
      });

      const newTrip = {
        id: response.data.id,
        destination: `${selectedDestination.city}, ${selectedDestination.country}`,
        startDate: tripDates.startDate,
        endDate: tripDates.endDate,
        notes: `Saved from destination card for ${selectedDestination.city}.`,
        activities: [],
      };

      onSaveItinerary(newTrip);
      closeSaveModal();
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
            <img
              src={destination.image || getUnsplashImage(destination)}
              alt={`${destination.city} skyline`}
              onError={(event) => {
                const { currentTarget } = event;
                const fallbackStage = currentTarget.dataset.fallbackStage || '0';

                if (fallbackStage === '0') {
                  currentTarget.dataset.fallbackStage = '1';
                  currentTarget.src = getUnsplashImage(destination);
                  return;
                }

                if (fallbackStage === '1') {
                  currentTarget.dataset.fallbackStage = '2';
                  currentTarget.src = getPicsumFallback(destination);
                }
              }}
            />

            <div className="destination-content">
              <h3>{destination.city}, {destination.country}</h3>
              <p>{destination.description}</p>

              {isMember ? (
                <button
                  onClick={() => openSaveModal(destination)}
                  disabled={saving === destination.id}
                >
                  {saving === destination.id ? 'Saving...' : 'Save itinerary'}
                </button>
              ) : (
                <Link to="/auth" className="small-link">Login to save itinerary</Link>
              )}
            </div>
          </article>
        ))}
      </div>

      {showSaveModal && selectedDestination && (
        <div className="save-modal-overlay">
          <div className="save-modal">
            <h2>Save itinerary</h2>
            <p className="muted-text">
              {selectedDestination.city}, {selectedDestination.country}
            </p>

            <label>Start date</label>
            <input
              type="date"
              value={tripDates.startDate}
              onChange={(e) =>
                setTripDates({ ...tripDates, startDate: e.target.value })
              }
            />

            <label>End date</label>
            <input
              type="date"
              value={tripDates.endDate}
              onChange={(e) =>
                setTripDates({ ...tripDates, endDate: e.target.value })
              }
            />

            <div className="save-modal-actions">
              <button onClick={handleConfirmSave}>
                Confirm Save
              </button>
              <button className="ghost-btn" onClick={closeSaveModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// login and signup page with base and premium plan selection
function AuthPage({ onAuthSuccess }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', role: 'base' });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  // handle both login and signup in one form based on the current mode
  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    try {
      if (mode === 'signup') {
        if (form.password !== form.confirmPassword) {
          setError('Passwords do not match');
          return;
        }

        await travelApi.signup({
          email: form.email,
          password: form.password,
          role: form.role
        });

        setSuccessMessage('Account created successfully!');

        setTimeout(() => {
          setSuccessMessage('');
          setMode('login');
          setForm({ ...form, password: '', confirmPassword: '' });
        }, 2000);
      } else {
        const response = await travelApi.login({ email: form.email, password: form.password });
        const userData = response.data.user || response.data;
        onAuthSuccess(userData);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Auth Error Details:', err.response?.data);
      setError(err.response?.data?.error || 'Authentication failed. Please try again.');
    }
  };

  return (
    <section className="auth-panel">
      <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>

      {error && <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>}
      {successMessage && <p style={{ color: 'green', fontWeight: 'bold' }}>{successMessage}</p>}

      <form onSubmit={onSubmit}>
        <label>Email</label>
        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

        <label>Password</label>
        <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />

        {mode === 'signup' && (
          <>
            <label>Account Type</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="role-select"
              style={{ marginBottom: '10px', padding: '8px', width: '100%' }}
            >
              <option value="base">Base (Free)</option>
              <option value="premium">Premium (Pro)</option>
            </select>

            <div
              style={{
                background: '#f0f4f8',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '15px',
                fontSize: '0.85rem',
                lineHeight: '1.4',
                borderLeft: form.role === 'premium' ? '4px solid #ffd700' : '4px solid #999'
              }}
            >
              {form.role === 'base' ? (
                <div>
                  <strong>Base Account Features:</strong>
                  <ul style={{ margin: '5px 0 0 18px', padding: 0 }}>
                    <li>Add up to 5 activities per trip itinerary.</li>
                    <li>Standard trip planning tools.</li>
                  </ul>
                </div>
              ) : (
                <div>
                  <strong>Premium Account Features: 3 Month Free Trial</strong>
                  <ul style={{ margin: '5px 0 0 18px', padding: 0 }}>
                    <li><strong>Unlimited</strong> activities per trip.</li>
                    <li><strong>Weather Insights:</strong> Local forecasts for your dates.</li>
                    <li><strong>Real Time Recommendations:</strong> Personalized activity suggestions.</li>
                    <li><strong>Event Search:</strong> Search local events during your trip dates.</li>
                  </ul>
                </div>
              )}
            </div>

            <label>Confirm Password</label>
            <input
              type="password"
              required
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            />
          </>
        )}

        <button type="submit" disabled={!!successMessage}>
          {mode === 'login' ? 'Login' : 'Sign up'}
        </button>
      </form>

      {!successMessage && (
        <button className="ghost-btn" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Login'}
        </button>
      )}
    </section>
  );
}

// simple dashboard that lists the signed in users saved trips
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
              <p>
                {(trip.start_date || trip.startDate)?.slice(0, 10)} to {(trip.end_date || trip.endDate)?.slice(0, 10)}
              </p>
            </div>
            <span>{trip.activities.length} activities</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// form page used for both creating a new trip and editing an existing one
function TripFormPage({ trips, onSaveTrip, member }) {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const editingTrip = trips.find((item) => String(item.id) === tripId);
  const [form, setForm] = useState(
    editingTrip || { destination: '', startDate: '', endDate: '', notes: '', activities: [] }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // save the trip to the backend and then move the user back to the dashboard
  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!DESTINATION_OPTIONS.includes(form.destination.trim())) {
        setError('Please select a destination from the dropdown list.');
        setLoading(false);
        return;
      }

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
        <input
          required
          list="destination-options"
          value={form.destination}
          placeholder="Search and select a destination"
          onChange={(e) => setForm({ ...form, destination: e.target.value })}
        />
        <datalist id="destination-options">
          {DESTINATION_OPTIONS.map((destination) => (
            <option key={destination} value={destination} />
          ))}
        </datalist>
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

// redirect guests away from member only pages
function ProtectedRoute({ isMember, children }) {
  if (!isMember) return <Navigate to="/auth" replace />;
  return children;
}

// main app component that manages auth state trip state and routing
function App() {
  // restore the signed in user from local storage when the app first opens
  const [member, setMemberState] = useState(() => {
    const savedUser = localStorage.getItem('travelPlannerUser');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (err) {
        console.error('Failed to restore user from localStorage:', err);
        localStorage.removeItem('travelPlannerUser');
        return null;
      }
    }
    return null;
  });

  // store the current users trips in local app state
  const [trips, setTrips] = useState(INITIAL_TRIPS);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const memberEmail = useMemo(() => member?.email || 'member@example.com', [member]);

  // keep the signed in user in both local storage and react state
  const setMember = (userData) => {
    if (userData) {
      localStorage.setItem('travelPlannerUser', JSON.stringify(userData));
    } else {
      localStorage.removeItem('travelPlannerUser');
    }
    setMemberState(userData);
  };

  // load the signed in users trips from the backend
  const fetchTripsFromDb = async () => {
    if (!member?.id) return;
    try {
      const res = await axios.get('http://localhost:3000/api/trips', {
        headers: { 'x-user-id': member.id }
      });
      setTrips(res.data);
    } catch (err) {
      console.error('Database sync failed', err);
    }
  };

  useEffect(() => {
    fetchTripsFromDb();
  }, [member?.id]);

  // call the backend route that upgrades a base account to premium
  const handleUpgradeToPremium = async () => {
    if (!member?.id) return;

    const confirmed = window.confirm('Upgrade your account to premium?');
    if (!confirmed) return;

    setIsUpgrading(true);
    try {
      const response = await travelApi.upgradeToPremium(member.id);
      const upgradedUser = {
        ...member,
        role: response.data.role
      };
      setMember(upgradedUser);
      alert('Your account has been upgraded to premium.');
    } catch (err) {
      console.error('Upgrade failed', err);
      alert(err.response?.data?.error || 'Failed to upgrade account.');
    } finally {
      setIsUpgrading(false);
    }
  };

  // add a newly saved itinerary card to the top of local state
  const saveItinerary = (newTrip) => {
    setTrips((current) => [newTrip, ...current]);
  };

  // add an activity through the backend and then refresh trip data
  const addActivity = async (tripId, activity) => {
    try {
      await travelApi.addActivity(tripId, activity, member?.id);
      await fetchTripsFromDb();
    } catch (err) {
      console.error('Add Activity Failed', err);
      alert(err.response?.data?.error || 'Failed to add activity.');
    }
  };

  // remove an activity through the backend and then refresh trip data
  const removeActivity = async (tripId, activityId) => {
    try {
      await travelApi.removeActivity(activityId);
      await fetchTripsFromDb();
    } catch (err) {
      console.error('Remove Activity Failed', err);
    }
  };

  // delete a trip through the backend and remove it from local state
  const removeTrip = async (tripId) => {
    if (!member?.id) return;
    try {
      await travelApi.deleteTrip(tripId, member.id);
      setTrips((current) => current.filter((trip) => trip.id !== tripId));
    } catch (err) {
      console.error('Delete Trip Failed', err);
      throw err;
    }
  };

  // update a trip in local state after create or edit actions
  const saveTrip = (trip) => {
    setTrips((current) => {
      const existing = current.find(item => item.id === trip.id);
      if (existing) {
        return current.map((item) => (item.id === trip.id ? { ...item, ...trip } : item));
      } else {
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

          {member && member.role === 'base' && (
            <button
              className="ghost-btn"
              onClick={handleUpgradeToPremium}
              disabled={isUpgrading}
            >
              {isUpgrading ? 'Upgrading...' : 'Upgrade to Premium'}
            </button>
          )}

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
                <TripDetailsPage
                  trips={trips}
                  onAddActivity={addActivity}
                  onRemoveActivity={removeActivity}
                  onRemoveTrip={removeTrip}
                  member={member}
                />
              </ProtectedRoute>
            )}
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;