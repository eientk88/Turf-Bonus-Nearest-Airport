# Nearest Airport Finder (Turf.js)

Interactive web map that identifies the nearest airport to any clicked location using spatial analysis with Turf.js. The application demonstrates client-side geographic analysis, cartographic layout design, and modern web mapping techniques.

# Live Map:
https://eientk88.github.io/Turf-Bonus-Nearest-Airport/

# Overview

This project visualizes a global airport dataset and allows users to click anywhere on the map to determine the nearest airport and its distance from the selected location.

The spatial analysis is performed directly in the browser using Turf.js, which calculates the nearest neighbor between the clicked location and a set of airport point features stored in a GeoJSON dataset.

The interface also includes search functionality, cartographic layout elements, and clear visual cues to communicate spatial relationships.

# Features
### Nearest Neighbor Spatial Analysis

Uses turf.nearestPoint() to identify the closest airport to a clicked location.

Distance between the click location and airport is calculated using Turf distance functions.

### Interactive Map

Built with Leaflet.js

Users can click anywhere on the map to trigger nearest airport analysis.

### Distance Visualization

A line is drawn between the clicked location and the nearest airport.

Distance is displayed in kilometers in a popup.

### Airport Search

Users can search airports by:

Airport name

IATA code

ICAO / GPS code

Abbreviation

Selecting a result zooms the map to that airport.

### Cartographic Design (TODALS)

# Dataset

Airports GeoJSON

Source dataset contains approximately 893 airport point features with attributes including:

Airport name

Abbreviation

IATA code

GPS / ICAO code

Wikipedia reference

Coordinates

Data format:

GeoJSON FeatureCollection
Geometry: Point

# Technologies Used
Technology	Purpose
Leaflet.js	Interactive web mapping
Turf.js	Spatial analysis and nearest neighbor calculations
GeoJSON	Geographic data format
OpenStreetMap	Basemap tiles
HTML / CSS / JavaScript	Application structure and styling

# How It Works

The airport dataset is loaded from airports.geojson.

Each airport is rendered as a point on the map.

When the user clicks the map:

A point is generated at the click location.

turf.nearestPoint() identifies the closest airport feature.

A line is drawn between the click point and the airport.

A popup displays airport details and distance.

# Author

Athanasios Karageorgos
Oregon State University

Date: March 4, 2026

# License

This project is for educational and academic purposes.

Base map data © OpenStreetMap contributors.
