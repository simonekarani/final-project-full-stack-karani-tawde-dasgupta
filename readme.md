# CSE264 Final Project: Full Stack
## Due: Friday, May 2, 2025 at 11:59 PM
# Travel Planner

CSE264 Final Project: Full Stack  
Due: Friday, May 2, 2025 at 11:59 PM

## Team Members and Roles

- Anisha Dasgupta — and327@lehigh.edu  
  Database design, and map integration

- Simone Karani — svk326@lehigh.edu  
  Frontend UI, and external API integration

- Ruhi Tawde — rut226@lehigh.edu  
  Internal REST API, interactive features, and state management

## Project Overview

Travel Planner is a full stack web application that helps users plan trips, save itineraries, manage activities, and explore destinations in a more organized way. Users can create an account, save trips, add activities to each trip, and view them on an interactive map. The app also connects to outside APIs to show recommendations, weather, and events for a destination.

The goal of the project is to make trip planning feel more practical and less overwhelming by keeping the main planning tools in one place.

## Project Purpose

Planning a trip usually means switching between different apps and tabs for places, maps, weather, and events. Our project brings those pieces together into a single workspace. A user can browse destinations, save a trip, build an itinerary, and explore nearby places without leaving the app.

## Application Features

### 1. User Accounts and Roles
- Users can sign up and log in with email and password
- Passwords are hashed using bcrypt
- The app supports guest and member behavior
- Guests can browse destinations
- Logged-in members can save trips, create itineraries, and manage activities

### 2. Database
- The app stores user, trip, and activity data in PostgreSQL (DBeaver)
- Main tables used:
  - `travelplanner_users`
  - `travelplanner_trips`
  - `travelplanner_activities`
- The backend reads from and writes to the database through SQL queries

### 3. Interactive UI
- Users can browse destination cards on the home page
- Members can save itineraries directly from destination cards
- Users can create, edit, and delete trips
- Users can add and remove activities from a trip
- The trip details page updates the itinerary and map dynamically
- The interface is designed to be responsive and usable across screen sizes

### 4. New Library / Framework
- We used **React Leaflet** for interactive map functionality
- This was used to display trip destinations and activity locations on a live map

### 5. Internal REST API
The backend includes routes for:
- user signup
- user login
- getting trips
- creating trips
- updating trips
- deleting trips
- adding activities
- deleting activities

### 6. External REST APIs
We integrated outside APIs to make the app more useful:
- **Google Places API** for destination recommendations and attractions
- **OpenWeather API / Open-Meteo** for weather information
- **Ticketmaster API** for destination events

## User Story / Use Case

When a user first visits the app, they can browse destination cards on the home page. If they want to save a trip or build an itinerary, they create an account or log in. Once logged in, they can save a destination as a trip, view it on their dashboard, and open the trip details page.

On the trip details page, the user can:
- see their saved itinerary
- add activities with location and date
- remove activities
- view the destination and activities on a map
- explore recommendations for places nearby
- check weather for the destination
- see events happening during the trip dates

This gives the user one main place to organize and update their trip plan.

## Tech Stack

### Frontend
- React
- Vite
- React Router
- Axios
- React Leaflet
- Leaflet

### Backend
- Node.js
- Express
- CORS
- dotenv
- bcrypt

### Database
- PostgreSQL

### External APIs
- Google Places API
- OpenWeather API / Open-Meteo
- Ticketmaster API

## How the Project Meets the Requirements

### User Accounts and Roles
Met through signup/login functionality and different guest vs member behavior.

### Database
Met through PostgreSQL tables for users, trips, and activities.

### Interactive UI
Met through dynamic trip cards, itinerary updates, forms, recommendations, weather, events, and map interactions.

### New Tool / Technology
Met through React Leaflet and Leaflet for map integration.

### Internal REST API
Met through Express routes used by the frontend to create, read, update, and delete app data.

### External REST API
Met through Google Places, weather, and events APIs.

## Folder Structure
```text
client/
server/
