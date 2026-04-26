import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export const travelApi = {
  signup: (credentials) =>
    apiClient.post('/signup', credentials),

  login: (credentials) =>
    apiClient.post('/login', credentials),

  getTrips: (userId) =>
    apiClient.get('/trips', {
      headers: { 'x-user-id': userId }
    }),

  createTrip: (tripData) =>
    apiClient.post('/trips', tripData, {
      headers: { 'x-user-id': tripData.user_id }
    }),

  updateTrip: (tripId, tripData) =>
    apiClient.put(`/trips/${tripId}`, tripData),

  deleteTrip: (tripId, userId) =>
    apiClient.delete(`/trips/${tripId}`, {
      headers: { 'x-user-id': userId }
    }),

  addActivity: (tripId, activityData, userId) =>
    apiClient.post(`/trips/${tripId}/activities`, activityData, {
      headers: { 'x-user-id': userId }
    }),

  updateActivity: (activityId, activityData) =>
    apiClient.put(`/activities/${activityId}`, activityData),

  removeActivity: (activityId) =>
    apiClient.delete(`/activities/${activityId}`),

  getRecommendations: (interest, city, userId) =>
    apiClient.get('/recommendations', {
      params: { interest, city },
      headers: { 'x-user-id': userId }
    }),

  getWeather: (city, date, userId) =>
    apiClient.get('/weather', {
      params: { city, date: date || '' },
      headers: { 'x-user-id': userId }
    }),

  getEvents: (destination, startDate, endDate, userId) =>
    apiClient.get('/events', {
      params: {
        destination,
        startDate: startDate || '',
        endDate: endDate || ''
      },
      headers: { 'x-user-id': userId }
    }),

  upgradeToPremium: (userId) =>
    apiClient.post(
      `/users/${userId}/upgrade`,
      {},
      { headers: { 'x-user-id': userId } }
    ),
};