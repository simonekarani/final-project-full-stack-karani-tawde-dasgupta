import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { travelApi } from './api.js'; 
import axios from 'axios';

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

  // The weather forecast should either be real expected if trip is in the next two weeks. If the trip is taking place after the next two weeks then the api will pull historical data to display for that time of year
    useEffect(() => {
    const fetchTripWeather = async () => {
        if (!trip?.destination || !trip?.startDate) return;
        setWeatherLoading(true);

    try {
        const city = trip.destination.split(',')[0].trim();
        // Step 1: Geocoding (Convert City Name to Coordinates)
        const geoRes = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`);
        
        if (geoRes.data.results) {
            const { latitude, longitude } = geoRes.data.results[0];

          // Determine if we use Forecast API (up to 14 days out) or Archive API
            const tripDate = new Date(trip.startDate);
            const today = new Date();
            const diffInDays = (tripDate - today) / (1000 * 60 * 60 * 24);

            let weatherUrl;
            if (diffInDays >= 0 && diffInDays <= 14) {
            // Use Live Forecast
            weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&start_date=${trip.startDate}&end_date=${trip.startDate}&daily=temperature_2m_max,weathercode&temperature_unit=fahrenheit&timezone=auto`;
            } else {
            // Use Historical Archive (for dates far in the future or past)
            // Note: We look at the same day from 1 year ago to provide a "Historical Average"
            const historicalDate = new Date(tripDate);
            historicalDate.setFullYear(historicalDate.getFullYear() - 1);
            const formattedDate = historicalDate.toISOString().split('T')[0];
            
            weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${formattedDate}&end_date=${formattedDate}&daily=temperature_2m_max,weathercode&temperature_unit=fahrenheit&timezone=auto`;
            }

            const weatherRes = await axios.get(weatherUrl);
          
            setWeather({
                temp: weatherRes.data.daily.temperature_2m_max[0],
                code: weatherRes.data.daily.weathercode[0],
                isHistorical: diffInDays > 14 || diffInDays < 0
            });
            }
        } catch (err) {
            console.error("Weather data fetch failed:", err);
        } finally {
            setWeatherLoading(false);
        }
        };

        fetchTripWeather();
    }, [trip?.destination, trip?.startDate]);

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
                    {Math.round(weather.temp)}°F
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#546e7a' }}>
                    {WEATHER_DESCRIPTIONS[weather.code] || "Variable"}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#90a4ae', marginTop: '4px', textTransform: 'uppercase' }}>
                    {weather.isHistorical ? "Historical Avg" : "Current Forecast"}
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
            <button type="submit" disabled={isSubmitting || loading}>
            {isSubmitting ? (
                <span className="spinner-small"></span> // Add CSS for a simple rotating border
            ) : (
                'Add Activity'
            )}
            </button>
            </form>
        </aside>
        </section>
    );
    }

    export default TripDetailsPage;