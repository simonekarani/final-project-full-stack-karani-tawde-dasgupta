import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { travelApi } from '../api.js';
import axios from 'axios';
import TripMap from '../components/TripMap';

// the open meteo API gives weather information in numerical values which then needs to be converted for user use
const WEATHER_DESCRIPTIONS = {
    0: "Clear Sky",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Foggy",
    51: "Drizzle",
    61: "Slight Rain",
    71: "Snowfall",
    95: "Thunderstorm"
};



function TripDetailsPage({ trips, onAddActivity, onRemoveActivity }) {
    const { tripId } = useParams();
    const trip = trips.find((item) => String(item.id) === tripId);

  // States
    const [activity, setActivity] = useState({ name: '', location: '', date: '', notes: '' });
    const [recommendations, setRecommendations] = useState([]);
    const [category, setCategory] = useState('museums');
    const [isSearching, setIsSearching] = useState(false); 
    const [weather, setWeather] = useState(null);
    const [weatherLoading, setWeatherLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(false);

  // The weather forecast should either be real expected if trip is in the next two weeks. If the trip is taking place after the next two weeks then the api will pull historical data to display for that time of year
// TripDetailsPage.js

useEffect(() => {
    const fetchTripWeather = async () => {
        if (!trip?.destination) return;
        setWeatherLoading(true);

        try {
            // 1. You need Lat/Lng. If your trip object doesn't have them, 
            // you can use the Open-Meteo Geocoding API first:
            const geoRes = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${trip.destination}&count=1&language=en&format=json`);
            const { latitude, longitude } = geoRes.data.results[0];

            // 2. Fetch from Open-Meteo
            // Using 'forecast' for upcoming trips or 'archive' for historical reference
            const weatherRes = await axios.get(`https://api.open-meteo.com/v1/forecast`, {
                params: {
                    latitude,
                    longitude,
                    current: "temperature_2m,relative_humidity_2m,weather_code",
                    temperature_unit: "fahrenheit",
                    wind_speed_unit: "mph",
                    timezone: "auto"
                }
            });

            const data = weatherRes.data.current;
            
            setWeather({
                temp: Math.round(data.temperature_2m),
                conditions: WEATHER_DESCRIPTIONS[data.weather_code] || "Clear",
                description: "Real-time data from Open-Meteo",
                humidity: data.relative_humidity_2m,
                isForecast: true
            });
        } catch (err) {
            console.error("Open-Meteo fetch failed:", err);
        } finally {
            setWeatherLoading(false);
        }
    };

    fetchTripWeather();
}, [trip?.destination, trip?.startDate]);

    // Fetch events for the trip destination and dates
    useEffect(() => {
        const fetchTripEvents = async () => {
            if (!trip?.destination || !trip?.startDate || !trip?.endDate) return;
            setEventsLoading(true);

            try {
                const city = trip.destination.split(',')[0].trim();
                const response = await travelApi.getEvents(city, trip.startDate, trip.endDate);
                setEvents(response.data.events || []);
            } catch (err) {
                console.error("Events data fetch failed:", err);
                setEvents([]);
            } finally {
                setEventsLoading(false);
            }
        };

        fetchTripEvents();
    }, [trip?.destination, trip?.startDate, trip?.endDate]);

    if (!trip) return <Navigate to="/dashboard" replace />;

    // Recommendation logic
    const handleSearchRecs = async () => {
        setIsSearching(true);
        try {
        const response = await axios.get(`http://localhost:3000/api/recommendations`, {
            params: { interest: category, city: trip.destination }
        });
        setRecommendations(response.data);
        } catch (err) {
        console.error("Discovery failed", err);
        } finally {
        setIsSearching(false);
        }
    };

    

    const [apiError, setApiError] = useState(null);

const submitActivity = async (event) => {
    event.preventDefault();
    if (!activity.name || !activity.location || !activity.date) return;

    setIsSubmitting(true);
    setApiError(null); 

    try {
        // This sends the data to your AWS RDS via your Express backend
        const response = await travelApi.addActivity(trip.id, activity);
        
        // This is the "Magic" step: 
        // It updates the state in your parent component (App.js), 
        // which flows back down to this page and refreshes the list instantly.
        onAddActivity(trip.id, response.data.activity);
        
        // Clear the form for the next entry
        setActivity({ name: '', location: '', date: '', notes: '' });
    } catch (err) {
        const message = err.response?.data?.error || "Unable to save activity.";
        setApiError(message);
    } finally {
        setIsSubmitting(false);
    }
};

    

    return (
        <section className="split-layout">
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
                <h2 style={{ margin: 0 }}>{trip.destination}</h2>
                <p className="muted-text" style={{ margin: '4px 0' }}>{trip.startDate} — {trip.endDate}</p>
            </div>

            {/* WEATHER COMPONENT */}
            <div className="weather-card" style={{ background: '#f0f4f8', padding: '12px', borderRadius: '12px', minWidth: '140px', textAlign: 'center' }}>
                {weatherLoading ? (
                <small>Syncing weather...</small>
                ) : weather ? (
                <>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    {weather.temp}°F
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#546e7a' }}>
                    {weather.conditions}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#90a4ae', marginTop: '4px' }}>
                    {weather.description}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#90a4ae', marginTop: '2px', textTransform: 'uppercase' }}>
                    {weather.isForecast ? "Forecast" : "Current"}
                    </div>
                </>
                ) : (
                <small>Weather N/A</small>
                )}
            </div>
            </div>
            
            {/* DISCOVERY SECTION */}
            <div className="discovery-box" style={{ background: '#f9f9f9', padding: '1.25rem', borderRadius: '10px', border: '1px solid #eee', marginBottom: '2rem' }}>
            <h3>Discover {trip.destination}</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="museums">Museums</option>
                <option value="cafes">Coffee Shops</option>
                <option value="parks">Parks</option>
                <option value="restaurants">Restaurants</option>
                </select>
                <button onClick={handleSearchRecs} disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Find Ideas'}
                </button>
            </div>

            <div className="rec-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {recommendations.map((rec) => (
                <div key={rec.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div>
                    <strong style={{ fontSize: '0.9rem' }}>{rec.name}</strong>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>{rec.address} • ⭐ {rec.rating}</p>
                    </div>
                    <button className="ghost-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setActivity({
                    name: rec.name,
                    location: rec.address,
                    date: trip.startDate,
                    notes: `Rating: ${rec.rating} stars. Imported from Discovery.`
                    })}>Use</button>
                </div>
                ))}
            </div>
            </div>

            {/* EVENTS SECTION */}
            <div className="events-box" style={{ background: '#fff8f0', padding: '1.25rem', borderRadius: '10px', border: '1px solid #ffe0b2', marginBottom: '2rem' }}>
            <h3>Events in {trip.destination}</h3>
            {eventsLoading ? (
                <p>Loading events...</p>
            ) : events.length > 0 ? (
                <div className="events-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {events.map((event) => (
                    <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0f0f0', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '0.9rem' }}>{event.name}</strong>
                        <p style={{ margin: '4px 0', fontSize: '0.8rem', color: '#666' }}>
                            {event.date} {event.time && `at ${event.time}`} • {event.venue}
                        </p>
                        {event.genre && <small style={{ color: '#888' }}>Genre: {event.genre}</small>}
                        {event.priceRange && <p style={{ margin: '2px 0', fontSize: '0.75rem', color: '#666' }}>Price: {event.priceRange}</p>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <button 
                            className="ghost-btn" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }} 
                            onClick={() => setActivity({
                                name: event.name,
                                location: `${event.venue}${event.address ? `, ${event.address}` : ''}, ${event.city}`,
                                date: event.date,
                                notes: `Event: ${event.genre || 'General'}. ${event.description || ''}`
                            })}
                        >
                            Add to Trip
                        </button>
                        {event.url && (
                            <a 
                                href={event.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ fontSize: '0.75rem', color: '#1976d2', textDecoration: 'none' }}
                            >
                                Get Tickets
                            </a>
                        )}
                    </div>
                    </div>
                ))}
                </div>
            ) : (
                <p>No events found for your trip dates.</p>
            )}
            </div>

            <div className="list-stack">
            {trip.activities.map((item) => (
                <article className="activity-row" key={item.id} style={{ padding: '12px', border: '1px solid #f0f0f0', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                    <strong>{item.name}</strong>
                    <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>{item.location} • {item.date}</p>
                    {item.notes && <small style={{ color: '#777' }}>{item.notes}</small>}
                </div>
                <button className="danger-btn" onClick={() => onRemoveActivity(trip.id, item.id)}>Remove</button>
                </article>
            ))}
            </div>

            {/* MAP SECTION */}
            <div className="map-section" style={{ marginTop: '2rem' }}>
            <h3>Trip Map</h3>
            <TripMap
                destination={{
                    name: trip.destination,
                    coordinates: [40.7128, -74.0060] // Default to NYC, could be enhanced with geocoding
                }}
                attractions={recommendations.filter(rec => rec.coordinates).map(rec => ({
                    id: rec.id,
                    name: rec.name,
                    location: rec.address,
                    coordinates: rec.coordinates
                }))}
                activities={trip.activities.filter(activity => activity.location).map(activity => ({
                    id: activity.id,
                    name: activity.name,
                    location: activity.location,
                    date: activity.date,
                    coordinates: [40.7128, -74.0060] // Default coordinates, could be enhanced
                }))}
                onMarkerClick={(item) => console.log('Clicked marker:', item)}
            />
            </div>
        </div>

        <aside className="form-card" style={{ position: 'sticky', top: '20px' }}>
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
            <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <span className="spinner-small">Saving...</span> : 'Add Activity'}
            </button>
            </form>
        </aside>
        </section>
    );
    }

    export default TripDetailsPage;