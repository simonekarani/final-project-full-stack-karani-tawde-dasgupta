import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
});

export const travelApi = {
  // Auth
    signup: (credentials) => 
    apiClient.post('/signup', credentials),
    
    login: (credentials) => 
    apiClient.post('/login', credentials),
    
  // Trip Management for your Postgres DB
    getTrips: (userId) => 
    apiClient.get('/trips', { headers: { 'x-user-id': userId } }),
    
    createTrip: (tripData) => 
    apiClient.post('/trips', tripData, { headers: { 'x-user-id': tripData.user_id } }),
    
    updateTrip: (tripId, tripData) => 
    apiClient.put(`/trips/${tripId}`, tripData),
    
    deleteTrip: (tripId, userId) => 
    apiClient.delete(`/trips/${tripId}`, { headers: { 'x-user-id': userId } }),
    
  // Activity Management
    addActivity: (tripId, activityData) => 
    apiClient.post(`/trips/${tripId}/activities`, activityData),
    
    updateActivity: (activityId, activityData) => 
    apiClient.put(`/activities/${activityId}`, activityData),
    
    removeActivity: (activityId) => 
    apiClient.delete(`/activities/${activityId}`),
    
  // Recommendations from your Google API
    getRecommendations: (interest, city) => 
    apiClient.get('/recommendations', { params: { interest, city } }),

  // Weather from OpenWeather API
    getWeather: (city, date) => 
    apiClient.get(`/weather?city=${city}&date=${date || ''}`),

  // Events from Ticketmaster API
    getEvents: (city, startDate, endDate) => 
    apiClient.get(`/events?city=${city}&startDate=${startDate || ''}&endDate=${endDate || ''}`),
};