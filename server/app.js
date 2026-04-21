import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcrypt'
import { query } from './db/postgres.js'

// create the app
const app = express()
// it's nice to set the port number so it's always the same
app.set('port', process.env.PORT || 3000);
// set up some middleware to handle processing body requests
app.use(express.json())
// set up some midlleware to handle cors
const cors = require('cors')
app.use(cors())

// base route
app.get('/', (req, res) => {
    res.send("Welcome to the Travel Planner Application API!!!")
})

app.get('/up', (req, res) => {
  res.json({status: 'up'})
})

// GET /api/recommendations?interest=museums&city=Paris
app.get('/api/recommendations', async (req, res) => {
    const { interest, city } = req.query;

    if (!interest || !city) {
        return res.status(400).json({ error: "Missing parameters. Need interest and city." });
    }

    try {
        // 1. The 2026 'New' Endpoint
        const url = 'https://places.googleapis.com/v1/places:searchText';

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': process.env.GM_API_KEY.trim(),
                // 2. Field Mask: Tell Google exactly what to return (saves money/quota!)
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.types,places.location'
            },
            body: JSON.stringify({
                textQuery: `${interest} in ${city}`,
                maxResultCount: 5
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Google Places 2026 Error:", data);
            return res.status(response.status).json(data);
        }

        // 3. Clean mapping for Simone's UI
        // Google (New) returns displayName as an object with 'text'
        const results = data.places.map(place => ({
            id: place.id,
            name: place.displayName?.text || "Unknown Name",
            address: place.formattedAddress,
            rating: place.rating || "N/A",
            category: place.types ? place.types[0].replace(/_/g, ' ') : 'Attraction',
            coordinates: place.location ? [place.location.latitude, place.location.longitude] : null
        }));

        res.json(results);

    } catch (err) {
        console.error("Connection Error:", err.message);
        res.status(500).json({ error: "Failed to connect to Google Places (New)" });
    }
});

// Weather endpoint using OpenWeather API
// GET /api/weather?city=Paris&date=2024-06-15
app.get('/api/weather', async (req, res) => {
    const { city, date } = req.query;

    if (!city) {
        return res.status(400).json({ error: "City parameter is required" });
    }

    try {
        // Get current weather or forecast based on date
        const today = new Date().toISOString().split('T')[0];
        const requestedDate = date || today;

        // For current weather (today)
        if (requestedDate === today) {
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${process.env.OPENWEATHER_API_KEY}&units=imperial`;

            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({ error: data.message || "Weather API error" });
            }

            res.json({
                temperature: Math.round(data.main.temp),
                conditions: data.weather[0].main,
                description: data.weather[0].description,
                humidity: data.main.humidity,
                windSpeed: data.wind.speed,
                icon: data.weather[0].icon,
                isForecast: false
            });
        } else {
            // For future dates, use 5-day forecast
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${process.env.OPENWEATHER_API_KEY}&units=imperial`;

            const response = await fetch(forecastUrl);
            const data = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({ error: data.message || "Forecast API error" });
            }

            // Find forecast for the requested date (forecasts are every 3 hours, so find closest match)
            const targetDate = new Date(requestedDate);
            const targetDay = targetDate.toISOString().split('T')[0];

            const dayForecasts = data.list.filter(item => {
                const itemDate = new Date(item.dt * 1000).toISOString().split('T')[0];
                return itemDate === targetDay;
            });

            if (dayForecasts.length === 0) {
                return res.status(404).json({ error: "No forecast available for this date" });
            }

            // Use midday forecast (around 12:00) or first available
            const middayForecast = dayForecasts.find(f => {
                const hour = new Date(f.dt * 1000).getHours();
                return hour >= 11 && hour <= 15;
            }) || dayForecasts[0];

            res.json({
                temperature: Math.round(middayForecast.main.temp),
                conditions: middayForecast.weather[0].main,
                description: middayForecast.weather[0].description,
                humidity: middayForecast.main.humidity,
                windSpeed: middayForecast.wind.speed,
                icon: middayForecast.weather[0].icon,
                isForecast: true,
                date: requestedDate
            });
        }

    } catch (err) {
        console.error("Weather API Error:", err.message);
        res.status(500).json({ error: "Failed to fetch weather data" });
    }
});

// Events endpoint using Ticketmaster API
// GET /api/events?city=Paris&startDate=2024-06-15&endDate=2024-06-20
app.get('/api/events', async (req, res) => {
    const { city, startDate, endDate } = req.query;

    if (!city) {
        return res.status(400).json({ error: "City parameter is required" });
    }

    try {
        let url = `https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(city)}&apikey=${process.env.TICKETMASTER_API_KEY}&size=20`;

        // Add date range if provided
        if (startDate && endDate) {
            url += `&startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z`;
        } else if (startDate) {
            url += `&startDateTime=${startDate}T00:00:00Z`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.message || "Events API error" });
        }

        // Transform Ticketmaster data to our format
        const events = data._embedded?.events?.map(event => ({
            id: event.id,
            name: event.name,
            date: event.dates.start.localDate,
            time: event.dates.start.localTime || null,
            venue: event._embedded?.venues?.[0]?.name || 'TBD',
            address: event._embedded?.venues?.[0]?.address?.line1 || null,
            city: event._embedded?.venues?.[0]?.city?.name || city,
            genre: event.classifications?.[0]?.genre?.name || null,
            priceRange: event.priceRanges ? `${event.priceRanges[0].min}-${event.priceRanges[0].max} ${event.priceRanges[0].currency}` : null,
            url: event.url,
            image: event.images?.find(img => img.width > 500)?.url || event.images?.[0]?.url,
            description: event.info || null
        })) || [];

        res.json({
            events: events,
            total: data.page?.totalElements || events.length
        });

    } catch (err) {
        console.error("Events API Error:", err.message);
        res.status(500).json({ error: "Failed to fetch events data" });
    }
});

// ===== AUTHENTICATION ENDPOINTS =====
// POST /api/signup
app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    try {
        // Check if user already exists
        const userResult = await query('SELECT id FROM users WHERE email = $1', [email]);
        
        if (userResult.rows.length > 0) {
            return res.status(409).json({ error: "User already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const insertResult = await query(
            'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email',
            [email, hashedPassword, 'user']
        );

        const user = insertResult.rows[0];
        res.status(201).json({
            id: user.id,
            email: user.email
        });
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({ error: "Failed to create account" });
    }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    try {
        // Find user
        const userResult = await query('SELECT id, email, password FROM users WHERE email = $1', [email]);
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = userResult.rows[0];

        // Check password
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        res.json({
            id: user.id,
            email: user.email
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Login failed" });
    }
});

// ===== TRIP ENDPOINTS =====
// GET /api/trips
app.get('/api/trips', async (req, res) => {
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    try {
        const tripsResult = await query(
            `SELECT id, user_id, destination, start_date, end_date, notes 
             FROM trips WHERE user_id = $1 ORDER BY start_date DESC`,
            [userId]
        );

        // Get activities for each trip
        const trips = await Promise.all(tripsResult.rows.map(async (trip) => {
            const activitiesResult = await query(
                'SELECT id, name, location, date, notes FROM activities WHERE trip_id = $1 ORDER BY date',
                [trip.id]
            );
            return {
                id: trip.id,
                destination: trip.destination,
                startDate: trip.start_date,
                endDate: trip.end_date,
                notes: trip.notes,
                activities: activitiesResult.rows.map(a => ({
                    id: a.id,
                    name: a.name,
                    location: a.location,
                    date: a.date,
                    notes: a.notes
                }))
            };
        }));

        res.json(trips);
    } catch (err) {
        console.error("Get trips error:", err);
        res.status(500).json({ error: "Failed to fetch trips" });
    }
});

// POST /api/trips
app.post('/api/trips', async (req, res) => {
    const { user_id, destination, start_date, end_date, notes } = req.body;

    if (!user_id || !destination || !start_date || !end_date) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const result = await query(
            'INSERT INTO trips (user_id, destination, start_date, end_date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [user_id, destination, start_date, end_date, notes || '']
        );

        res.status(201).json({
            id: result.rows[0].id
        });
    } catch (err) {
        console.error("Create trip error:", err);
        res.status(500).json({ error: "Failed to create trip" });
    }
});

// PUT /api/trips/:tripId
app.put('/api/trips/:tripId', async (req, res) => {
    const { tripId } = req.params;
    const { destination, start_date, end_date, notes } = req.body;

    if (!destination || !start_date || !end_date) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        await query(
            'UPDATE trips SET destination = $1, start_date = $2, end_date = $3, notes = $4 WHERE id = $5',
            [destination, start_date, end_date, notes || '', tripId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Update trip error:", err);
        res.status(500).json({ error: "Failed to update trip" });
    }
});

// DELETE /api/trips/:tripId
app.delete('/api/trips/:tripId', async (req, res) => {
    const { tripId } = req.params;

    try {
        // Delete activities first
        await query('DELETE FROM activities WHERE trip_id = $1', [tripId]);
        // Then delete trip
        await query('DELETE FROM trips WHERE id = $1', [tripId]);

        res.json({ success: true });
    } catch (err) {
        console.error("Delete trip error:", err);
        res.status(500).json({ error: "Failed to delete trip" });
    }
});

// ===== ACTIVITY ENDPOINTS =====
// POST /api/trips/:tripId/activities
app.post('/api/trips/:tripId/activities', async (req, res) => {
    const { tripId } = req.params;
    const { name, location, date, notes } = req.body;

    if (!name || !location || !date) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const result = await query(
            'INSERT INTO activities (trip_id, name, location, date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [tripId, name, location, date, notes || '']
        );

        res.status(201).json({
            id: result.rows[0].id
        });
    } catch (err) {
        console.error("Add activity error:", err);
        res.status(500).json({ error: "Failed to add activity" });
    }
});

// DELETE /api/activities/:activityId
app.delete('/api/activities/:activityId', async (req, res) => {
    const { activityId } = req.params;

    try {
        await query('DELETE FROM activities WHERE id = $1', [activityId]);
        res.json({ success: true });
    } catch (err) {
        console.error("Delete activity error:", err);
        res.status(500).json({ error: "Failed to delete activity" });
    }
});

app.listen(app.get('port'), () => {
    console.log('App is running at http://localhost:%d in %s mode', app.get('port'), app.get('env'))
    console.log('  Press CTRL-C to stop\n')
  })
  