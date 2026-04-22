import { useState, useEffect,useMemo } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
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



function TripDetailsPage({ trips, onAddActivity, onRemoveActivity, onRemoveTrip }) {
    const { tripId } = useParams();
    const navigate = useNavigate();
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
    const [isDeletingTrip, setIsDeletingTrip] = useState(false);

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

    const submitActivity = async (event) => {
        event.preventDefault();
        if (!activity.name || !activity.location || !activity.date) return;

        setIsSubmitting(true);
        try {
            // Just trigger the App.js function
            await onAddActivity(trip.id, activity);
            
            // Clear the form after success
            setActivity({ name: '', location: '', date: '', notes: '' });
        } catch (err) {
            console.error("Submit failed", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTrip = async () => {
        const confirmed = window.confirm('Delete this trip and all of its activities?');
        if (!confirmed) return;

        setIsDeletingTrip(true);
        try {
            await onRemoveTrip(trip.id);
            navigate('/dashboard');
        } catch (err) {
            console.error("Trip delete failed", err);
            alert('Failed to delete trip. Please try again.');
        } finally {
            setIsDeletingTrip(false);
        }
    };

    // 1. Group the activities by date
    const groupedActivities = useMemo(() => {
        if (!trip?.activities) return {};
        
        return trip.activities.reduce((groups, activity) => {
            const date = activity.date; // Ensure this matches your DB column name
            if (!groups[date]) groups[date] = [];
            groups[date].push(activity);
            return groups;
        }, {});
    }, [trip.activities]); // This recalculates automatically when App.js finishes the fetch

    // 2. Sort the dates so the itinerary is chronological
    const sortedDates = Object.keys(groupedActivities).sort();
        const [apiError, setApiError] = useState(null);

    const groupedRecs = recommendations.reduce((acc, rec) => {
        const cat = rec.category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(rec);
        return acc;
    }, {});

    

    return (
        <section className="split-layout">
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
                <h2 style={{ margin: 0 }}>{trip.destination}</h2>
                <h4> Trip Dates: 
                {(trip.start_date || trip.startDate)?.slice(0, 10)} to {(trip.end_date || trip.endDate)?.slice(0, 10)}
                </h4>
                <p className="muted-text" style={{ margin: '4px 0' }}>{trip.startDate} — {trip.endDate}</p>
                <button
                    className="danger-btn"
                    type="button"
                    style={{ marginTop: '8px' }}
                    disabled={isDeletingTrip}
                    onClick={handleDeleteTrip}
                >
                    {isDeletingTrip ? 'Deleting...' : 'Delete Trip'}
                </button>
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
                    <select 
                        value={category} 
                        onChange={(e) => setCategory(e.target.value)}
                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc', flex: 1 }}
                    >
                        <optgroup label="Popular">
                            <option value="tourist_attraction">Must See Sights</option>
                            <option value="museum">Museums</option>
                            <option value="park">Parks & Nature</option>
                        </optgroup>
                        <optgroup label="Food & Drink">
                            <option value="restaurant">Restaurants</option>
                            <option value="cafe">Coffee Shops</option>
                            <option value="bakery">Bakeries</option>
                            <option value="bar">Bars & Nightlife</option>
                            <option value="brewery">Breweries</option>
                        </optgroup>
                        <optgroup label="Culture & Arts">
                            <option value="art_gallery">Art Galleries</option>
                            <option value="performing_arts_theater">Theaters</option>
                            <option value="library">Libraries</option>
                        </optgroup>
                        <optgroup label="Entertainment">
                            <option value="aquarium">Aquariums</option>
                            <option value="zoo">Zoos</option>
                            <option value="amusement_park">Amusement Parks</option>
                            <option value="movie_theater">Cinemas</option>
                        </optgroup>
                    </select>
                    <button 
                        onClick={handleSearchRecs} 
                        disabled={isSearching}
                        style={{ padding: '8px 16px', cursor: isSearching ? 'not-allowed' : 'pointer' }}
                    >
                        {isSearching ? 'Searching...' : 'Find Ideas'}
                    </button>
                </div>

                <div className="rec-list" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '5px' }}>
                    {Object.keys(groupedRecs).length > 0 ? (
                        Object.entries(groupedRecs).map(([catName, items]) => (
                            <div key={catName} style={{ marginBottom: '1.5rem' }}>
                                {/* SEGMENT HEADER */}
                                <h4 style={{ 
                                    fontSize: '0.7rem', 
                                    textTransform: 'uppercase', 
                                    color: '#1976d2', 
                                    letterSpacing: '1px',
                                    borderBottom: '1px solid #e0e0e0',
                                    paddingBottom: '4px',
                                    marginBottom: '8px'
                                }}>
                                    {catName}
                                </h4>

                                {/* ITEMS IN CATEGORY */}
                                {items.map((rec) => (
                                    <div key={rec.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f9f9f9', alignItems: 'center' }}>
                                        <div style={{ flex: 1, paddingRight: '10px' }}>
                                            <strong style={{ fontSize: '0.9rem', display: 'block' }}>{rec.name}</strong>
                                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#666' }}>{rec.address}</p>
                                            <small style={{ color: '#f39c12' }}>★ {rec.rating}</small>
                                        </div>
                                        
                                        {/* POPULATE FORM BUTTON */}
                                        <button 
                                            className="ghost-btn" 
                                            style={{ padding: '6px 12px', fontSize: '0.75rem' }} 
                                            onClick={() => setActivity({
                                                name: rec.name,
                                                location: rec.address,
                                                date: '', // Keeps date empty so user picks it in the form
                                                notes: `Imported from Discovery (${catName}). Rating: ${rec.rating} stars.`
                                            })}
                                        >
                                            Use
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ))
                    ) : (
                        !isSearching && <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#999', marginTop: '20px' }}>Select a category to start exploring.</p>
                    )}
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

            <div className="itinerary-section" style={{ marginTop: '2rem' }}>
                <h3 style={{ borderBottom: '2px solid #1976d2', paddingBottom: '8px', color: '#1976d2' }}>
                    Your Itinerary
                </h3>

                {sortedDates.length === 0 ? (
                    <p className="muted-text">No activities planned yet. Start by adding one in the sidebar!</p>
                ) : (
                    sortedDates.map((date) => (
                        <div key={date} className="itinerary-day" style={{ marginBottom: '1.5rem' }}>
                            {/* DAY HEADER */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                                <div style={{ 
                                    background: '#1976d2', 
                                    color: 'white', 
                                    padding: '4px 12px', 
                                    borderRadius: '16px', 
                                    fontSize: '0.85rem', 
                                    fontWeight: 'bold' 
                                }}>
                                    {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </div>
                                <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }}></div>
                            </div>

                            {/* ACTIVITIES FOR THIS DAY */}
                            <div style={{ paddingLeft: '20px', borderLeft: '2px solid #f0f0f0', marginLeft: '40px' }}>
                                {groupedActivities[date].map((item) => (
                                    <article className="activity-row" key={item.id} style={{ 
                                        padding: '12px', 
                                        border: '1px solid #f0f0f0', 
                                        borderRadius: '8px', 
                                        marginBottom: '10px', 
                                        display: 'flex', 
                                        justifyContent: 'space-between',
                                        background: 'white'
                                    }}>
                                        <div>
                                            <strong style={{ color: '#333' }}>{item.name}</strong>
                                            <p style={{ margin: '4px 0', fontSize: '0.8rem', color: '#666' }}>📍 {item.location}</p>
                                            {item.notes && <small style={{ color: '#888', fontStyle: 'italic' }}>"{item.notes}"</small>}
                                        </div>
                                        <button className="danger-btn" style={{ padding: '4px 10px', fontSize: '0.7rem' }} onClick={() => onRemoveActivity(trip.id, item.id)}>
                                            Remove
                                        </button>
                                    </article>
                                ))}
                            </div>
                        </div>
                    ))
                )}
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