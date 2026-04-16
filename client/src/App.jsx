import { useMemo, useState } from 'react';
import axios from 'axios';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
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

function HomePage({ isMember, onSaveItinerary }) {
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
                <button onClick={() => onSaveItinerary(destination)}>
                  Save itinerary
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
  const navigate = useNavigate();

  const onSubmit = (event) => {
    event.preventDefault();
    onAuthSuccess(form.email);
    navigate('/dashboard');
  };

  return (
    <section className="auth-panel">
      <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
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

  if (!trip) {
    return <Navigate to="/dashboard" replace />;
  }

  const submitActivity = (event) => {
    event.preventDefault();
    if (!activity.name || !activity.location || !activity.date) return;
    onAddActivity(trip.id, activity);
    setActivity({ name: '', location: '', date: '', notes: '' });
  };

  return (
    <section className="split-layout">
      <div>
        <h2>{trip.destination}</h2>
        <p className="muted-text">{trip.startDate} - {trip.endDate}</p>
        <p>{trip.notes}</p>
        <div className="list-stack">
          {trip.activities.map((item) => (
            <article className="activity-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.location} • {item.date}</p>
                {item.notes && <small>{item.notes}</small>}
              </div>
              <button className="danger-btn" onClick={() => onRemoveActivity(trip.id, item.id)}>Remove</button>
            </article>
          ))}
        </div>
      </div>
      <aside className="form-card">
        <h3>Add Activity</h3>
        <form onSubmit={submitActivity}>
          <label>Name</label>
          <input value={activity.name} onChange={(e) => setActivity({ ...activity, name: e.target.value })} />
          <label>Location</label>
          <input value={activity.location} onChange={(e) => setActivity({ ...activity, location: e.target.value })} />
          <label>Date</label>
          <input type="date" value={activity.date} onChange={(e) => setActivity({ ...activity, date: e.target.value })} />
          <label>Notes</label>
          <textarea value={activity.notes} onChange={(e) => setActivity({ ...activity, notes: e.target.value })} rows="3" />
          <button type="submit">Add activity</button>
        </form>
      </aside>
    </section>
  );
}

function TripFormPage({ trips, onSaveTrip }) {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const editingTrip = trips.find((item) => String(item.id) === tripId);
  const [form, setForm] = useState(
    editingTrip || { destination: '', startDate: '', endDate: '', notes: '', activities: [] }
  );

  const onSubmit = (event) => {
    event.preventDefault();
    onSaveTrip({ ...form, id: editingTrip?.id });
    navigate('/dashboard');
  };

  return (
    <section className="form-card">
      <h2>{editingTrip ? 'Edit trip' : 'Create trip'}</h2>
      <form onSubmit={onSubmit}>
        <label>Destination</label>
        <input required value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
        <label>Start date</label>
        <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        <label>End date</label>
        <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        <label>Trip notes</label>
        <textarea rows="4" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button type="submit">{editingTrip ? 'Update trip' : 'Create trip'}</button>
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

  // handling user login
  const handleLogin = async (email, password) => {
  try {
      const response = await travelApi.login({ email, password });
      // This 'response.data' comes from your POST /api/login route in app.js
      setMember(response.data); 
      navigate('/dashboard');
  } catch (err) {
      alert("Login failed! Check your credentials.");
  }
  };

  const saveItinerary = (destination) => {
    const newTrip = {
      id: Date.now(),
      destination: `${destination.city}, ${destination.country}`,
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      notes: `Saved from destination card for ${destination.city}.`,
      activities: [],
    };
    setTrips((current) => [newTrip, ...current]);
  };

  const addActivity = (tripId, activity) => {
    setTrips((current) =>
      current.map((trip) =>
        trip.id === tripId
          ? { ...trip, activities: [...trip.activities, { ...activity, id: Date.now() }] }
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
      if (trip.id) {
        return current.map((item) => (item.id === trip.id ? { ...item, ...trip } : item));
      }
      return [{ ...trip, id: Date.now(), activities: [] }, ...current];
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
          <Route path="/" element={<HomePage isMember={Boolean(member)} onSaveItinerary={saveItinerary} />} />
          <Route path="/auth" element={<AuthPage onAuthSuccess={(email) => setMember({ email })} />} />
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
                <TripFormPage trips={trips} onSaveTrip={saveTrip} />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/trips/edit/:tripId"
            element={(
              <ProtectedRoute isMember={Boolean(member)}>
                <TripFormPage trips={trips} onSaveTrip={saveTrip} />
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
