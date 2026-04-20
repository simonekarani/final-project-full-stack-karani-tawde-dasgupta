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
    61: "Slight Rain",
    63: "Moderate Rain",
    71: "Snowfall",
    80: "Rain Showers",
    95: "Thunderstorm",
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
    useEffect(() => {
    const fetchTripWeather = async () => {
        if (!trip?.destination) return;
        setWeatherLoading(true);

    try {
        const city = trip.destination.split(',')[0].trim();
        
        // Use OpenWeather API for current weather or forecast
        const tripDate = new Date(trip.startDate);
        const today = new Date();
        const diffInDays = (tripDate - today) / (1000 * 60 * 60 * 24);
        
        // For dates within 5 days, we can get forecast. For farther dates, we'll show current weather as reference
        const dateToFetch = (diffInDays >= 0 && diffInDays <= 5) ? trip.startDate : null;
        
        const response = await travelApi.getWeather(city, dateToFetch);
        const weatherData = response.data;
          
        setWeather({
            temp: weatherData.temperature,
            conditions: weatherData.conditions,
            description: weatherData.description,
            humidity: weatherData.humidity,
            windSpeed: weatherData.windSpeed,
            icon: weatherData.icon,
            isForecast: weatherData.isForecast || false
        });
        } catch (err) {
            console.error("Weather data fetch failed:", err);
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
    setApiError(null); // Clear previous errors

    try {
        const response = await travelApi.addActivity(trip.id, activity);
        onAddActivity(trip.id, response.data.activity);
        setActivity({ name: '', location: '', date: '', notes: '' });
    } catch (err) {
        // Check if the backend sent a specific message, otherwise use a fallback
        const message = err.response?.data?.error || "Unable to save activity. Check your connection.";
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