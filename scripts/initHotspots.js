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
        posX: 19.5,
        posY: 19.5,
        description: "Explore the world of Stranger Things",
        houseId: 1
    },
    {
        title: "Squid Game",
        type: "primary",
        posX: 48.8,
        posY: 32.6,
        description: "Experience the Squid Game universe",
        houseId: 1
    },
    {
        title: "Bridgerton",
        type: "primary",
        posX: 29.3,
        posY: 58.6,
        description: "Step into the world of Bridgerton",
        houseId: 1
    },
    {
        title: "Wednesday",
        type: "primary",
        posX: 68.4,
        posY: 45.6,
        description: "Visit Wednesday's world",
        houseId: 1
    },
    // House 2 hotspots
    {
        title: "The Crown",
        type: "primary",
        posX: 25.5,
        posY: 25.5,
        description: "Experience the royal drama",
        houseId: 2
    },
    {
        title: "The Witcher",
        type: "primary",
        posX: 55.8,
        posY: 35.6,
        description: "Enter the world of The Witcher",
        houseId: 2
    },
    {
        title: "Money Heist",
        type: "primary",
        posX: 35.3,
        posY: 65.6,
        description: "Join the heist",
        houseId: 2
    },
    {
        title: "Dark",
        type: "primary",
        posX: 75.4,
        posY: 40.6,
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