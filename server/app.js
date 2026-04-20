import 'dotenv/config'
import express from 'express'
import cors from 'cors'

// create the app
const app = express()
// it's nice to set the port number so it's always the same
app.set('port', process.env.PORT || 3000);
// set up some middleware to handle processing body requests
app.use(express.json())
// set up some midlleware to handle cors
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

app.listen(app.get('port'), () => {
    console.log('App is running at http://localhost:%d in %s mode', app.get('port'), app.get('env'))
    console.log('  Press CTRL-C to stop\n')
  })
  