import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { query } from './db/postgres.js';

const app = express();

// Use port 5000 to avoid conflict with React (which uses 3000)
app.set('port', process.env.PORT || 3000);

// Middleware
app.use(express.json());
app.use(cors());

// Base routes
app.get('/', (req, res) => {
    res.send("Welcome to the Travel Planner API!");
});

app.get('/up', (req, res) => {
    res.json({ status: 'up' });
});

// ===== RECOMMENDATIONS (Google Places 2026) =====
app.get('/api/recommendations', async (req, res) => {
    const { interest, city } = req.query;
    if (!interest || !city) return res.status(400).json({ error: "Missing parameters." });

    try {
        const url = 'https://places.googleapis.com/v1/places:searchText';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': process.env.GM_API_KEY.trim(),
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.types,places.location'
            },
            body: JSON.stringify({ textQuery: `${interest} in ${city}`, maxResultCount: 5 })
        });

        const data = await response.json();
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
        res.status(500).json({ error: "Failed to connect to Google Places" });
    }
});

// ===== AUTHENTICATION (Updated for travelplanner_users) =====
app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userCheck = await query('SELECT id FROM travelplanner_users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) return res.status(409).json({ error: "User exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await query(
            'INSERT INTO travelplanner_users (email, password) VALUES ($1, $2) RETURNING id, email',
            [email, hashedPassword]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Signup failed" });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await query('SELECT id, email, password FROM travelplanner_users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

        const match = await bcrypt.compare(password, result.rows[0].password);
        if (!match) return res.status(401).json({ error: "Invalid credentials" });

        res.json({ id: result.rows[0].id, email: result.rows[0].email });
    } catch (err) {
        res.status(500).json({ error: "Login failed" });
    }
});

// ===== TRIPS (Updated for travelplanner_trips) =====
app.get('/api/trips', async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(400).json({ error: "User ID required" });

    try {
        const tripsRes = await query(
            'SELECT id, destination, start_date, end_date, notes FROM travelplanner_trips WHERE user_id = $1 ORDER BY start_date DESC',
            [userId]
        );

        const trips = await Promise.all(tripsRes.rows.map(async (trip) => {
            const actRes = await query(
                'SELECT id, name, location, date, notes FROM travelplanner_activities WHERE trip_id = $1 ORDER BY date',
                [trip.id]
            );
            return { ...trip, activities: actRes.rows };
        }));
        res.json(trips);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch trips" });
    }
});

app.post('/api/trips', async (req, res) => {
    const { user_id, destination, start_date, end_date, notes } = req.body;
    try {
        const result = await query(
            'INSERT INTO travelplanner_trips (user_id, destination, start_date, end_date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [user_id, destination, start_date, end_date, notes]
        );
        res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: "Failed to create trip" });
    }
});

// ===== ACTIVITIES (Updated for travelplanner_activities) =====
app.post('/api/trips/:tripId/activities', async (req, res) => {
    const { tripId } = req.params;
    const { name, location, date, notes } = req.body;
    try {
        const result = await query(
            'INSERT INTO travelplanner_activities (trip_id, name, location, date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [tripId, name, location, date, notes]
        );
        res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: "Failed to add activity" });
    }
});

app.delete('/api/activities/:activityId', async (req, res) => {
    try {
        await query('DELETE FROM travelplanner_activities WHERE id = $1', [req.params.activityId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

//add activity
app.post('/api/activities', async (req, res) => {
    const { name, address, rating } = req.body; // Data from Google API
    
    const sql = `INSERT INTO activities (name, address, rating) VALUES ($1, $2, $3) RETURNING *`;
    
    try {
        const result = await query(sql, [name, address, rating]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).send("Database error");
    }
});

//get activities
// server/app.js

// 1. GET route to fetch all activities for the UI
app.get('/api/activities', async (req, res) => {
  try {
    const result = await query('SELECT * FROM activities ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

app.listen(app.get('port'), () => {
    console.log(`Server running at http://localhost:${app.get('port')}`);
});

