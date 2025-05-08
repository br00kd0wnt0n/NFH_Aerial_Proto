const express = require('express');
const router = express.Router();
const Hotspot = require('../models/hotspot');

// Get hotspots for a specific house
router.get('/', async (req, res) => {
    try {
        const { houseId } = req.query;
        console.log('Fetching hotspots for houseId:', houseId);
        
        const query = houseId ? { houseId: parseInt(houseId) } : {};
        console.log('MongoDB query:', query);
        
        const hotspots = await Hotspot.find(query);
        console.log('Found hotspots:', hotspots);
        
        res.json({ hotspots });
    } catch (error) {
        console.error('Error fetching hotspots:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save hotspots for a house
router.post('/', async (req, res) => {
    try {
        const { houseId, hotspots } = req.body;
        console.log('Saving hotspots for houseId:', houseId);
        console.log('Hotspots data:', hotspots);
        
        if (!houseId || !Array.isArray(hotspots)) {
            return res.status(400).json({ error: 'Invalid request data' });
        }

        // Delete existing hotspots for this house
        await Hotspot.deleteMany({ houseId });

        // Validate each hotspot before saving
        const validatedHotspots = hotspots.map(hotspot => ({
            title: hotspot.title,
            type: hotspot.type,
            posX: parseFloat(hotspot.posX),
            posY: parseFloat(hotspot.posY),
            description: hotspot.description || '',
            houseId: parseInt(houseId)
        }));

        // Save new hotspots
        const savedHotspots = await Hotspot.insertMany(validatedHotspots);
        console.log('Saved hotspots:', savedHotspots);
        res.json({ hotspots: savedHotspots });
    } catch (error) {
        console.error('Error saving hotspots:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete a specific hotspot
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Hotspot.findByIdAndDelete(id);
        res.json({ message: 'Hotspot deleted successfully' });
    } catch (error) {
        console.error('Error deleting hotspot:', error);
        res.status(500).json({ error: 'Failed to delete hotspot' });
    }
});

module.exports = router; 