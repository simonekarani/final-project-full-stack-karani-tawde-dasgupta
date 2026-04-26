import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcrypt'
import { query } from './db/postgres.js'

const app = express()

app.set('port', process.env.PORT || 3000)

app.use(express.json())
app.use(cors())

// basic health route for browser check
app.get('/', (req, res) => {
  res.send('Welcome to the Travel Planner API!')
})

// simple api health route
app.get('/up', (req, res) => {
  res.json({ status: 'up' })
})

// find one user by id so routes can check role
async function getUserById(userId) {
  const result = await query(
    'SELECT id, email, role FROM travelplanner_users WHERE id = $1',
    [userId]
  )
  return result.rows[0] || null
}

// find the owner of a trip and their role
async function getTripOwnerRole(tripId) {
  const result = await query(
    `SELECT u.id, u.role
     FROM travelplanner_trips t
     JOIN travelplanner_users u ON t.user_id = u.id
     WHERE t.id = $1`,
    [tripId]
  )
  return result.rows[0] || null
}

// recommendations are only for premium users
app.get('/api/recommendations', async (req, res) => {
  const { interest, city } = req.query
  const userId = req.headers['x-user-id']

  // make sure a logged in user is making the request
  if (!userId) {
    return res.status(401).json({ error: 'User ID required' })
  }

  const user = await getUserById(userId)

  // stop if the user does not exist
  if (!user) {
    return res.status(401).json({ error: 'User not found' })
  }

  // only premium users can use discovery
  if (user.role !== 'premium') {
    return res.status(403).json({ error: 'Recommendations are available for premium users only' })
  }

  // both search pieces are needed
  if (!interest || !city) {
    return res.status(400).json({ error: 'Missing parameters.' })
  }

  try {
    const url = 'https://places.googleapis.com/v1/places:searchText'
    const searchString = `${interest.replace(/_/g, ' ')} in ${city}`

    // call google places text search
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

    // return empty list if nothing comes back
    if (!data.places) {
      return res.json([])
    }

    // shape the api data into simpler frontend data
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

app.get('/api/weather', async (req, res) => {
  const { city, date } = req.query
  const userId = req.headers['x-user-id']

  // require a logged in user
  if (!userId) {
    return res.status(401).json({ error: 'User ID required' })
  }

  const user = await getUserById(userId)

  // stop if user cannot be found
  if (!user) {
    return res.status(401).json({ error: 'User not found' })
  }

  // block base users from weather
  if (user.role !== 'premium') {
    return res.status(403).json({ error: 'Weather is available for premium users only' })
  }

  // city is required
  if (!city) {
    return res.status(400).json({ error: 'City parameter is required' })
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    const requestedDate = date || today

    // helper for current weather
    const fetchCurrentWeather = async () => {
      const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${process.env.OPENWEATHER_API_KEY}&units=imperial`

      const currentResponse = await fetch(currentUrl)
      const currentData = await currentResponse.json()

      if (!currentResponse.ok) {
        return res.status(currentResponse.status).json({
          error: currentData.message || 'Weather API error'
        })
      }

      return res.json({
        temperature: Math.round(currentData.main.temp),
        conditions: currentData.weather[0].main,
        description: currentData.weather[0].description,
        humidity: currentData.main.humidity,
        windSpeed: currentData.wind.speed,
        icon: currentData.weather[0].icon,
        isForecast: false
      })
    }

    // use current weather for today or past dates
    if (requestedDate <= today) {
      return await fetchCurrentWeather()
    }

    // use forecast endpoint for future dates
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${process.env.OPENWEATHER_API_KEY}&units=imperial`

    const response = await fetch(forecastUrl)
    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Forecast API error' })
    }

    const targetDay = requestedDate

    // keep only the entries for the requested day
    const dayForecasts = data.list.filter((item) => {
      const itemDate = new Date(item.dt * 1000).toISOString().split('T')[0]
      return itemDate === targetDay
    })

    // if forecast not available for that exact day then fall back to current weather
    if (dayForecasts.length === 0) {
      return await fetchCurrentWeather()
    }

    // try to use a midday forecast first
    const middayForecast =
      dayForecasts.find((f) => {
        const hour = new Date(f.dt * 1000).getHours()
        return hour >= 11 && hour <= 15
      }) || dayForecasts[0]

    return res.json({
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

// turn a destination string into coordinates
async function geocodeDestinationLabel(label) {
  if (!label?.trim()) return null

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(label.trim())}&count=1&language=en&format=json`
  const response = await fetch(url)
  const data = await response.json()
  const hit = data.results?.[0]

  if (!hit) return null

  return {
    lat: hit.latitude,
    lon: hit.longitude,
    country: hit.country_code || null,
    label: hit.name
  }
}

// reshape predicthq event data for the frontend
function mapPredictHqEvent(event) {
  const venueEntity = event.entities?.find((e) => e.type === 'venue')
  const addr =
    event.geo?.address?.formatted_address ||
    venueEntity?.formatted_address ||
    null
  const locality =
    event.geo?.address?.locality ||
    event.geo?.address?.region ||
    venueEntity?.name ||
    'TBD'

  let date = ''
  let time = null

  if (event.start_local) {
    const [d, rest] = event.start_local.split('T')
    date = d || event.start_local.slice(0, 10)
    if (rest) time = rest.slice(0, 5)
  } else if (event.start) {
    date = event.start.slice(0, 10)
  }

  return {
    id: event.id,
    name: event.title,
    date,
    time,
    venue: venueEntity?.name || locality,
    address: addr,
    city: locality,
    genre: event.category || null,
    priceRange: null,
    url: null,
    image: null,
    description: event.description
      ? String(event.description).replace(/<[^>]+>/g, '').slice(0, 400)
      : null,
    source: 'predicthq'
  }
}

// fetch events from predicthq
async function fetchPredictHqEvents({ lat, lon, country, activeGte, activeLte }) {
  const token = process.env.PREDICTHQ_API_KEY?.trim()

  // skip if no predicthq key exists
  if (!token) return { events: [], rawCount: 0, skipped: true }

  const params = new URLSearchParams({
    limit: '25',
    sort: '-rank',
    'active.gte': activeGte,
    'active.lte': activeLte,
    within: `60km@${lat},${lon}`
  })

  if (country && /^[A-Za-z]{2}$/.test(country)) {
    params.set('country', country.toUpperCase())
  }

  const phqUrl = `https://api.predicthq.com/v1/events/?${params.toString()}`
  const response = await fetch(phqUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  })

  let data = {}
  try {
    data = await response.json()
  } catch {
    // ignore non json bodies here
  }

  if (!response.ok) {
    const msg = data.detail || data.message || data.error_description || 'PredictHQ error'
    console.error('PredictHQ events error:', response.status, msg)
    return { events: [], rawCount: 0, error: msg, status: response.status }
  }

  const results = Array.isArray(data.results) ? data.results : []
  return {
    events: results.map(mapPredictHqEvent),
    rawCount: typeof data.count === 'number' ? data.count : results.length
  }
}

// fetch events from ticketmaster as a fallback
async function fetchTicketmasterEvents(city, startDate, endDate) {
  const key = process.env.TICKETMASTER_API_KEY?.trim()

  // skip if no ticketmaster key exists
  if (!key || key === 'ticketmaster_api_key') return []

  let url = `https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(city)}&apikey=${key}&size=20`

  if (startDate && endDate) {
    url += `&startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z`
  } else if (startDate) {
    url += `&startDateTime=${startDate}T00:00:00Z`
  }

  const response = await fetch(url)
  const data = await response.json()

  if (!response.ok) return []

  return (
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
      description: event.info || null,
      source: 'ticketmaster'
    })) || []
  )
}

// event search is premium only
app.get('/api/events', async (req, res) => {
  const userId = req.headers['x-user-id']

  // require logged in user
  if (!userId) {
    return res.status(401).json({ error: 'User ID required' })
  }

  const user = await getUserById(userId)

  // stop if user cannot be found
  if (!user) {
    return res.status(401).json({ error: 'User not found' })
  }

  // block base users from event search
  if (user.role !== 'premium') {
    return res.status(403).json({ error: 'Event search is available for premium users only' })
  }

  const destination = (req.query.destination || req.query.city || '').trim()
  const { startDate, endDate } = req.query

  // destination and date range are required
  if (!destination) {
    return res.status(400).json({ error: 'destination (or city) query parameter is required' })
  }

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' })
  }

  try {
    const geo = await geocodeDestinationLabel(destination)

    // stop if destination cannot be geocoded
    if (!geo) {
      return res.json({
        events: [],
        total: 0,
        message: 'Could not geocode destination for event search.',
        source: null,
        predicthqConfigured: Boolean(process.env.PREDICTHQ_API_KEY?.trim())
      })
    }

    const phq = await fetchPredictHqEvents({
      lat: geo.lat,
      lon: geo.lon,
      country: geo.country,
      activeGte: startDate,
      activeLte: endDate
    })

    let events = phq.events
    let total = phq.rawCount ?? events.length
    let source = 'predicthq'
    const predicthqConfigured = Boolean(process.env.PREDICTHQ_API_KEY?.trim())
    let message = null

    // try ticketmaster if predicthq returns nothing
    if (events.length === 0) {
      const cityPart = destination.split(',')[0].trim()
      const tm = await fetchTicketmasterEvents(cityPart, startDate, endDate)

      if (tm.length > 0) {
        events = tm
        total = tm.length
        source = 'ticketmaster'
      } else if (!predicthqConfigured) {
        message =
          'PredictHQ is not configured. Add PREDICTHQ_API_KEY to the server .env file (Bearer token from PredictHQ).'
      } else if (phq.error) {
        message = `PredictHQ request failed (${phq.status || 'error'}). ${phq.error}`
      }
    }

    res.json({
      events,
      total,
      source,
      geocodedAs: geo.label,
      predicthqConfigured,
      message
    })
  } catch (err) {
    console.error('Events API Error:', err)
    res.status(500).json({ error: 'Failed to fetch events data' })
  }
})

// signup route creates a user with base or premium role
app.post('/api/signup', async (req, res) => {
  const { email, password, role } = req.body

  // require email and password
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const userCheck = await query(
      'SELECT id FROM travelplanner_users WHERE email = $1',
      [email]
    )

    // prevent duplicate emails
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ error: 'User exists' })
    }

    // only allow the two valid roles
    const validRoles = ['base', 'premium']
    const assignedRole = validRoles.includes(role) ? role : 'base'

    // hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await query(
      'INSERT INTO travelplanner_users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, hashedPassword, assignedRole]
    )

    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('Signup error:', err)
    res.status(500).json({ error: 'Signup failed' })
  }
})

// login route returns user info including role
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body

  // require email and password
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const result = await query(
      'SELECT id, email, password, role FROM travelplanner_users WHERE email = $1',
      [email]
    )

    // fail if the email is unknown
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // compare entered password with stored hash
    const match = await bcrypt.compare(password, result.rows[0].password)

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    res.json({
      id: result.rows[0].id,
      email: result.rows[0].email,
      role: result.rows[0].role
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// lets a base user upgrade to premium
app.post('/api/users/:userId/upgrade', async (req, res) => {
  const { userId } = req.params
  const requesterId = req.headers['x-user-id']

  // require logged in user id
  if (!requesterId) {
    return res.status(401).json({ error: 'User ID required' })
  }

  // only allow users to upgrade their own account
  if (String(requesterId) !== String(userId)) {
    return res.status(403).json({ error: 'You can only upgrade your own account' })
  }

  try {
    const user = await getUserById(userId)

    // stop if user is missing
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // return early if already premium
    if (user.role === 'premium') {
      return res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        message: 'Account is already premium'
      })
    }

    const result = await query(
      `UPDATE travelplanner_users
       SET role = 'premium'
       WHERE id = $1
       RETURNING id, email, role`,
      [userId]
    )

    res.json({
      id: result.rows[0].id,
      email: result.rows[0].email,
      role: result.rows[0].role,
      message: 'Account upgraded to premium'
    })
  } catch (err) {
    console.error('Upgrade account error:', err)
    res.status(500).json({ error: 'Failed to upgrade account' })
  }
})

// get all trips for one logged in user
app.get('/api/trips', async (req, res) => {
  const userId = req.headers['x-user-id']

  // require a user id header
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

    // fetch activities for each trip and bundle them together
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

// create a new trip
app.post('/api/trips', async (req, res) => {
  const { user_id, destination, start_date, end_date, notes } = req.body

  // require the main trip fields
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

// update an existing trip
app.put('/api/trips/:tripId', async (req, res) => {
  const { tripId } = req.params
  const { destination, start_date, end_date, notes } = req.body

  // require the main trip fields
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

// delete a trip and its activities
app.delete('/api/trips/:tripId', async (req, res) => {
  const userId = req.headers['x-user-id']
  const { tripId } = req.params

  // require logged in user
  if (!userId) {
    return res.status(400).json({ error: 'User ID required' })
  }

  try {
    // delete child activities first
    await query('DELETE FROM travelplanner_activities WHERE trip_id = $1', [tripId])

    // only delete the trip if it belongs to that user
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

// add an activity to a trip
app.post('/api/trips/:tripId/activities', async (req, res) => {
  const { tripId } = req.params
  const { name, location, date, notes } = req.body
  const userId = req.headers['x-user-id']

  // require logged in user
  if (!userId) {
    return res.status(401).json({ error: 'User ID required' })
  }

  // require the main activity fields
  if (!name || !location || !date) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const owner = await getTripOwnerRole(tripId)

    // stop if the trip cannot be found
    if (!owner) {
      return res.status(404).json({ error: 'Trip not found' })
    }

    // make sure only the trip owner can add to it
    if (String(owner.id) !== String(userId)) {
      return res.status(403).json({ error: 'You do not have permission to modify this trip' })
    }

    // base users can only have five activities on a trip
    if (owner.role === 'base') {
      const countResult = await query(
        'SELECT COUNT(*)::int AS count FROM travelplanner_activities WHERE trip_id = $1',
        [tripId]
      )

      const currentCount = countResult.rows[0].count

      if (currentCount >= 5) {
        return res.status(403).json({ error: 'Base users can only add up to 5 activities per trip' })
      }
    }

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

// delete a single activity
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

// fetch all activities if needed for testing
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

// start the express server
app.listen(app.get('port'), () => {
  console.log(`Server running at http://localhost:${app.get('port')}`)
})