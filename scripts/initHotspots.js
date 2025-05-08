const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Import the Hotspot model
const Hotspot = require('../models/hotspot');

// Default hotspots for both houses
const defaultHotspots = [
    // House 1 hotspots
    {
        title: "Stranger Things",
        type: "primary",
        points: [
            { x: 19.5, y: 19.5 },
            { x: 21.5, y: 19.5 },
            { x: 21.5, y: 21.5 },
            { x: 19.5, y: 21.5 }
        ],
        description: "Explore the world of Stranger Things",
        houseId: 1
    },
    {
        title: "Squid Game",
        type: "primary",
        points: [
            { x: 48.8, y: 32.6 },
            { x: 50.8, y: 32.6 },
            { x: 50.8, y: 34.6 },
            { x: 48.8, y: 34.6 }
        ],
        description: "Experience the Squid Game universe",
        houseId: 1
    },
    {
        title: "Bridgerton",
        type: "primary",
        points: [
            { x: 29.3, y: 58.6 },
            { x: 31.3, y: 58.6 },
            { x: 31.3, y: 60.6 },
            { x: 29.3, y: 60.6 }
        ],
        description: "Step into the world of Bridgerton",
        houseId: 1
    },
    {
        title: "Wednesday",
        type: "primary",
        points: [
            { x: 68.4, y: 45.6 },
            { x: 70.4, y: 45.6 },
            { x: 70.4, y: 47.6 },
            { x: 68.4, y: 47.6 }
        ],
        description: "Visit Wednesday's world",
        houseId: 1
    },
    // House 2 hotspots
    {
        title: "The Crown",
        type: "primary",
        points: [
            { x: 25.5, y: 25.5 },
            { x: 27.5, y: 25.5 },
            { x: 27.5, y: 27.5 },
            { x: 25.5, y: 27.5 }
        ],
        description: "Experience the royal drama",
        houseId: 2
    },
    {
        title: "The Witcher",
        type: "primary",
        points: [
            { x: 55.8, y: 35.6 },
            { x: 57.8, y: 35.6 },
            { x: 57.8, y: 37.6 },
            { x: 55.8, y: 37.6 }
        ],
        description: "Enter the world of The Witcher",
        houseId: 2
    },
    {
        title: "Money Heist",
        type: "primary",
        points: [
            { x: 35.3, y: 65.6 },
            { x: 37.3, y: 65.6 },
            { x: 37.3, y: 67.6 },
            { x: 35.3, y: 67.6 }
        ],
        description: "Join the heist",
        houseId: 2
    },
    {
        title: "Dark",
        type: "primary",
        points: [
            { x: 75.4, y: 40.6 },
            { x: 77.4, y: 40.6 },
            { x: 77.4, y: 42.6 },
            { x: 75.4, y: 42.6 }
        ],
        description: "Explore the mysteries of Dark",
        houseId: 2
    }
];

// Initialize hotspots
async function initializeHotspots() {
    try {
        // Clear existing hotspots
        await Hotspot.deleteMany({});
        
        // Insert new hotspots
        await Hotspot.insertMany(defaultHotspots);
        
        console.log('Hotspots initialized successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error initializing hotspots:', error);
        process.exit(1);
    }
}

initializeHotspots(); 