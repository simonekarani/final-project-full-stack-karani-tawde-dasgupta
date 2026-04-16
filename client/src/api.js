import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
});

export const travelApi = {
  // Recommendations from your Google API
    getRecommendations: (interest, city) => 
    apiClient.get(`/recommendations?interest=${interest}&city=${city}`),

  // Trip Management for your Postgres DB
    getTrips: (userId) => 
    apiClient.get('/trips', { headers: { 'x-user-id': userId } }),
    
    createTrip: (tripData) => 
    apiClient.post('/trips', tripData),
    
  // Auth
    login: (credentials) => 
    apiClient.post('/login', credentials),
};