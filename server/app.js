import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcrypt'
import { query } from './db/postgres.js'

const app = express()

app.set('port', process.env.PORT || 3000)

app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
  res.send('Welcome to the Travel Planner API!')
})

app.get('/up', (req, res) => {
  res.json({ status: 'up' })
})

// ===== RECOMMENDATIONS =====
app.get('/api/recommendations', async (req, res) => {
  const { interest, city } = req.query

  if (!interest || !city) {
    return res.status(400).json({ error: 'Missing parameters.' })
  }

  try {
    const url = 'https://places.googleapis.com/v1/places:searchText'
    const searchString = `${interest.replace(/_/g, ' ')} in ${city}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GM_API_KEY.trim(),
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.rating,places.types,places.location'
      },
      body: JSON.stringify({
        textQuery: searchString,
        maxResultCount: 10
      })
    })

    const data = await response.json()

    if (!data.places) {
      return res.json([])
    }

    const results = data.places.map((place) => ({
      id: place.id,
      name: place.displayName?.text || 'Unknown Name',
      address: place.formattedAddress,
      rating: place.rating || 'N/A',
      category: place.types ? place.types[0].replace(/_/g, ' ') : 'Attraction',
      coordinates: place.location
        ? [place.location.latitude, place.location.longitude]
        : null
    }))

    res.json(results)
  } catch (err) {
    console.error('Discovery Error:', err)
    res.status(500).json({ error: 'Failed to connect to Google Places' })
  }
})

// ===== WEATHER =====
app.get('/api/weather', async (req, res) => {
  const { city, date } = req.query

  if (!city) {
    return res.status(400).json({ error: 'City parameter is required' })
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    const requestedDate = date || today

    if (requestedDate === today) {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${process.env.OPENWEATHER_API_KEY}&units=imperial`

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        return res.status(response.status).json({ error: data.message || 'Weather API error' })
      }

      return res.json({
        temperature: Math.round(data.main.temp),
        conditions: data.weather[0].main,
        description: data.weather[0].description,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        icon: data.weather[0].icon,
        isForecast: false
      })
    }

    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${process.env.OPENWEATHER_API_KEY}&units=imperial`

    const response = await fetch(forecastUrl)
    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Forecast API error' })
    }

    const targetDate = new Date(requestedDate)
    const targetDay = targetDate.toISOString().split('T')[0]

    const dayForecasts = data.list.filter((item) => {
      const itemDate = new Date(item.dt * 1000).toISOString().split('T')[0]
      return itemDate === targetDay
    })

    if (dayForecasts.length === 0) {
      return res.status(404).json({ error: 'No forecast available for this date' })
    }

    const middayForecast =
      dayForecasts.find((f) => {
        const hour = new Date(f.dt * 1000).getHours()
        return hour >= 11 && hour <= 15
      }) || dayForecasts[0]

    res.json({
      temperature: Math.round(middayForecast.main.temp),
      conditions: middayForecast.weather[0].main,
      description: middayForecast.weather[0].description,
      humidity: middayForecast.main.humidity,
      windSpeed: middayForecast.wind.speed,
      icon: middayForecast.weather[0].icon,
      isForecast: true,
      date: requestedDate
    })
  } catch (err) {
    console.error('Weather API Error:', err)
    res.status(500).json({ error: 'Failed to fetch weather data' })
  }
})

// ===== EVENTS =====
app.get('/api/events', async (req, res) => {
  const { city, startDate, endDate } = req.query

  if (!city) {
    return res.status(400).json({ error: 'City parameter is required' })
  }

  try {
    let url = `https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(city)}&apikey=${process.env.TICKETMASTER_API_KEY}&size=20`

    if (startDate && endDate) {
      url += `&startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z`
    } else if (startDate) {
      url += `&startDateTime=${startDate}T00:00:00Z`
    }

    const response = await fetch(url)
    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Events API error' })
    }

    const events =
      data._embedded?.events?.map((event) => ({
        id: event.id,
        name: event.name,
        date: event.dates.start.localDate,
        time: event.dates.start.localTime || null,
        venue: event._embedded?.venues?.[0]?.name || 'TBD',
        address: event._embedded?.venues?.[0]?.address?.line1 || null,
        city: event._embedded?.venues?.[0]?.city?.name || city,
        genre: event.classifications?.[0]?.genre?.name || null,
        priceRange: event.priceRanges
          ? `${event.priceRanges[0].min}-${event.priceRanges[0].max} ${event.priceRanges[0].currency}`
          : null,
        url: event.url,
        image: event.images?.find((img) => img.width > 500)?.url || event.images?.[0]?.url,
        description: event.info || null
      })) || []

    res.json({
      events,
      total: data.page?.totalElements || events.length
    })
  } catch (err) {
    console.error('Events API Error:', err)
    res.status(500).json({ error: 'Failed to fetch events data' })
  }
})

// ===== AUTH =====
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const userCheck = await query(
      'SELECT id FROM travelplanner_users WHERE email = $1',
      [email]
    )

    if (userCheck.rows.length > 0) {
      return res.status(409).json({ error: 'User exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await query(
      'INSERT INTO travelplanner_users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email',
      [email, hashedPassword, 'user']
    )

    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('Signup error:', err)
    res.status(500).json({ error: 'Signup failed' })
  }
})

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const result = await query(
      'SELECT id, email, password FROM travelplanner_users WHERE email = $1',
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const match = await bcrypt.compare(password, result.rows[0].password)

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    res.json({
      id: result.rows[0].id,
      email: result.rows[0].email
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// ===== TRIPS =====
app.get('/api/trips', async (req, res) => {
  const userId = req.headers['x-user-id']

  if (!userId) {
    return res.status(400).json({ error: 'User ID required' })
  }

  try {
    const tripsRes = await query(
      `SELECT id, destination, start_date, end_date, notes
       FROM travelplanner_trips
       WHERE user_id = $1
       ORDER BY start_date DESC`,
      [userId]
    )

    const trips = await Promise.all(
      tripsRes.rows.map(async (trip) => {
        const actRes = await query(
          `SELECT id, name, location, date, notes
           FROM travelplanner_activities
           WHERE trip_id = $1
           ORDER BY date`,
          [trip.id]
        )

        return {
          id: trip.id,
          destination: trip.destination,
          startDate: trip.start_date,
          endDate: trip.end_date,
          notes: trip.notes,
          activities: actRes.rows
        }
      })
    )

    res.json(trips)
  } catch (err) {
    console.error('Get trips error:', err)
    res.status(500).json({ error: 'Failed to fetch trips' })
  }
})

app.post('/api/trips', async (req, res) => {
  const { user_id, destination, start_date, end_date, notes } = req.body

  if (!user_id || !destination || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const result = await query(
      `INSERT INTO travelplanner_trips (user_id, destination, start_date, end_date, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [user_id, destination, start_date, end_date, notes || '']
    )

    res.status(201).json({ id: result.rows[0].id })
  } catch (err) {
    console.error('Create trip error:', err)
    res.status(500).json({ error: 'Failed to create trip' })
  }
})

app.put('/api/trips/:tripId', async (req, res) => {
  const { tripId } = req.params
  const { destination, start_date, end_date, notes } = req.body

  if (!destination || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    await query(
      `UPDATE travelplanner_trips
       SET destination = $1, start_date = $2, end_date = $3, notes = $4
       WHERE id = $5`,
      [destination, start_date, end_date, notes || '', tripId]
    )

    res.json({ success: true })
  } catch (err) {
    console.error('Update trip error:', err)
    res.status(500).json({ error: 'Failed to update trip' })
  }
})

app.delete('/api/trips/:tripId', async (req, res) => {
  const userId = req.headers['x-user-id']
  const { tripId } = req.params

  if (!userId) {
    return res.status(400).json({ error: 'User ID required' })
  }

  try {
    await query('DELETE FROM travelplanner_activities WHERE trip_id = $1', [tripId])

    const tripResult = await query(
      'DELETE FROM travelplanner_trips WHERE id = $1 AND user_id = $2 RETURNING id',
      [tripId, userId]
    )

    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' })
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Delete trip error:', err)
    res.status(500).json({ error: 'Failed to delete trip' })
  }
})

// ===== ACTIVITIES =====
app.post('/api/trips/:tripId/activities', async (req, res) => {
  const { tripId } = req.params
  const { name, location, date, notes } = req.body

  if (!name || !location || !date) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const result = await query(
      `INSERT INTO travelplanner_activities (trip_id, name, location, date, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tripId, name, location, date, notes || '']
    )

    res.status(201).json({ activity: result.rows[0] })
  } catch (err) {
    console.error('Add activity error:', err)
    res.status(500).json({ error: 'Failed to add activity' })
  }
})

app.delete('/api/activities/:activityId', async (req, res) => {
  try {
    await query(
      'DELETE FROM travelplanner_activities WHERE id = $1',
      [req.params.activityId]
    )
    res.json({ success: true })
  } catch (err) {
    console.error('Delete activity error:', err)
    res.status(500).json({ error: 'Delete failed' })
  }
})

app.get('/api/activities', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM travelplanner_activities ORDER BY date DESC'
    )
    res.json(result.rows)
  } catch (err) {
    console.error('Fetch activities error:', err)
    res.status(500).json({ error: 'Failed to fetch activities' })
  }
})

app.listen(app.get('port'), () => {
  console.log(`Server running at http://localhost:${app.get('port')}`)
})