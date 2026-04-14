import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { query } from './db/postgres.js';

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


//User Accounts

// POST /signup
app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body
    try {
        const sql = `INSERT INTO users (email, password, role) VALUES ($1, $2, 'member') RETURNING id, email, role`
        const result = await query(sql, [email, password])
        res.status(201).json(result.rows[0])
    } catch (err) {
        res.status(500).json({ error: "Signup failed. User might already exist." })
    }
})

// POST /login NEEDS EDITING
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const sql = `SELECT id, email, role FROM users WHERE email = $1 AND password = $2`;
        const result = await query(sql, [email, password]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(401).json({ error: "Invalid email or password" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /me - Check current user 
app.get('/api/me', async (req, res) => {
    const userId = req.headers['x-user-id'] // Temporary way to track user until JWT is added
    if (!userId) return res.status(401).json({ error: "Unauthorized" })

    try {
        const result = await query('SELECT id, email, role FROM users WHERE id = $1', [userId])
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found" })
        res.json(result.rows[0])
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
});

//Trip Endpoints

// GET /trips - Get all trips for a specific user
app.get('/api/trips', async (req, res) => {
    const userId = req.headers['x-user-id']
    try {
        const sql = `SELECT * FROM trips WHERE user_id = $1 ORDER BY start_date ASC`
        const result = await query(sql, [userId])
        res.json(result.rows)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// POST /trips - Create a new trip
app.post('/api/trips', async (req, res) => {
    const { user_id, destination, start_date, end_date } = req.body
    try {
        const sql = `INSERT INTO trips (user_id, destination, start_date, end_date) 
                     VALUES ($1, $2, $3, $4) RETURNING *`
        const result = await query(sql, [user_id, destination, start_date, end_date])
        res.status(201).json(result.rows[0])
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// DELETE /trips/:id - Delete a trip
app.delete('/api/trips/:id', async (req, res) => {
    try {
        await query('DELETE FROM trips WHERE id = $1', [req.params.id])
        res.json({ message: "Trip deleted successfully" })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// PUT /api/trips/:id - Update an existing trip
app.get('/api/trips/:id', async (req, res) => {
    const { id } = req.params;
    const { destination, start_date, end_date } = req.body

    try {
        // COALESCE ensures we don't overwrite data with NULL if a field is missing in req.body
        const sql = `
            UPDATE trips 
            SET 
                destination = COALESCE($1, destination), 
                start_date = COALESCE($2, start_date), 
                end_date = COALESCE($3, end_date)
            WHERE id = $4
            RETURNING *`

        const result = await query(sql, [destination, start_date, end_date, id])

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Trip not found" })
        }

        res.json({
            message: "Trip updated successfully",
            trip: result.rows[0]
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
});

//Activity Endpoints

// POST /api/trips/:id/activities - Add a new activity to a specific trip
app.post('/api/trips/:id/activities', async (req, res) => {
    const { id } = req.params // This is the trip_id from the URL
    const { name, location, date, notes } = req.body

    // Basic validation to ensure name is provided
    if (!name) {
        return res.status(400).json({ error: "Activity name is required" })
    }

    try {
        const sql = `
            INSERT INTO activities (trip_id, name, location, date, notes) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *`

        const result = await query(sql, [id, name, location, date, notes]);

        res.status(201).json({
            message: "Activity added to trip!",
            activity: result.rows[0]
        });
    } catch (err) {
        console.error("Error adding activity:", err.message);
        res.status(500).json({ error: "Could not add activity. Check if the trip ID exists." })
    }
})

// PUT /api/activities/:id - Update an activity (notes, time, location)
app.put('/api/activities/:id', async (req, res) => {
    const { id } = req.params
    const { name, location, date, notes } = req.body

    try {
        const sql = `
            UPDATE activities 
            SET 
                name = COALESCE($1, name), 
                location = COALESCE($2, location), 
                date = COALESCE($3, date),
                notes = COALESCE($4, notes)
            WHERE id = $5
            RETURNING *`

        const result = await query(sql, [name, location, date, notes, id])

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Activity not found" })
        }

        res.json({
            message: "Activity updated",
            activity: result.rows[0]
        })
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})

// DELETE /api/activities/:id - Remove an activity from a trip
app.delete('/api/activities/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const sql = `DELETE FROM activities WHERE id = $1 RETURNING *`;
        const result = await query(sql, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Activity not found" });
        }

        res.json({ message: "Activity deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//recommendations
// GET /api/recommendations?interest=museums&city=Paris
app.get('/api/recommendations', async (req, res) => {
    const { interest, city } = req.query;

    // 1. Validation
    if (!interest || !city) {
        return res.status(400).json({ error: "Please provide both an interest and a city." })
    }

    try {
        // Build the URL with search parameters
        const searchParams = new URLSearchParams({
            query: interest,
            near: city,
            fields: 'fsq_id,name,location,rating,photos',
            limit: 5
        })

        const response = await fetch(`https://api.foursquare.com/v3/places/search?${searchParams}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': process.env.FOURSQUARE_API_KEY // Key should be in .env
            }
        })

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Foursquare API error")
        }

        const data = await response.json()

        // Map the data so it's clean for Simone/Frontend
        const results = data.results.map(place => ({
            id: place.fsq_id,
            name: place.name,
            address: place.location.formatted_address,
            rating: place.rating || 'N/A'
        }))

        res.json({
            context: { interest, city },
            results: results
        })

    } catch (err) {
        console.error("External API Error:", err.message)
        res.status(500).json({ error: "Failed to fetch recommendations from external provider." })
    }
});

app.listen(app.get('port'), () => {
    console.log('App is running at http://localhost:%d in %s mode', app.get('port'), app.get('env'))
    console.log('  Press CTRL-C to stop\n')
  })
  