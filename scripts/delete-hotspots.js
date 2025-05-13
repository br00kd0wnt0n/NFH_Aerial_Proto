const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Import the Hotspot model
const Hotspot = require('../models/hotspot');

// Delete hotspots for both houses
async function deleteHotspots() {
    try {
        // Delete hotspots for house ID 1 (KOP)
        const result1 = await Hotspot.deleteMany({ houseId: 1 });
        console.log(`Deleted ${result1.deletedCount} hotspots for house ID 1 (KOP)`);
        
        // Delete hotspots for house ID 2 (Dallas)
        const result2 = await Hotspot.deleteMany({ houseId: 2 });
        console.log(`Deleted ${result2.deletedCount} hotspots for house ID 2 (Dallas)`);
        
        process.exit(0);
    } catch (error) {
        console.error('Error deleting hotspots:', error);
        process.exit(1);
    }
}

deleteHotspots(); 