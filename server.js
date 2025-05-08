const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const multer = require('multer');
const assetRoutes = require('./routes/assets');
const hotspotRoutes = require('./routes/hotspots');

const app = express();
const upload = multer();

// Middleware
app.use(cors());
app.use(express.json());

// Debug middleware to log requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Serve static files with detailed logging
app.use('/admin', express.static(path.join(__dirname, 'admin'), {
    setHeaders: (res, path) => {
        console.log(`Serving static file: ${path}`);
    }
}));
app.use(express.static(path.join(__dirname, 'public')));

// Environment variables
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/netflix-house';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/assets', assetRoutes);
app.use('/api/hotspots', hotspotRoutes);

// Playlist Schema
const playlistSchema = new mongoose.Schema({
    houseId: { type: Number, required: true },
    playlists: { type: Map, of: Object, default: new Map() }
});

const Playlist = mongoose.model('Playlist', playlistSchema);

// Get playlists for a house
app.get('/api/playlists', async (req, res) => {
    try {
        const { houseId } = req.query;
        if (!houseId) {
            return res.status(400).json({ error: 'House ID is required' });
        }

        let playlist = await Playlist.findOne({ houseId: parseInt(houseId) });
        if (!playlist) {
            playlist = new Playlist({ houseId: parseInt(houseId) });
            await playlist.save();
        }

        res.json({ playlists: playlist.playlists });
    } catch (error) {
        console.error('Error fetching playlists:', error);
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
});

// Save playlists for a house
app.post('/api/playlists', async (req, res) => {
    try {
        const { houseId, playlists } = req.body;
        if (!houseId || !playlists) {
            return res.status(400).json({ error: 'House ID and playlists are required' });
        }

        let playlist = await Playlist.findOne({ houseId: parseInt(houseId) });
        if (!playlist) {
            playlist = new Playlist({ houseId: parseInt(houseId) });
        }

        playlist.playlists = playlists;
        await playlist.save();

        res.json({ message: 'Playlists saved successfully' });
    } catch (error) {
        console.error('Error saving playlists:', error);
        res.status(500).json({ error: 'Failed to save playlists' });
    }
});

// Get assets endpoint
app.get('/api/assets', async (req, res) => {
    try {
        const { type, houseId, hotspotId } = req.query;
        const query = {};

        if (type) query.type = type;
        if (houseId) query.houseId = houseId;
        if (hotspotId) query.hotspotId = hotspotId;

        const assets = await Asset.find(query);
        res.json({ assets });
    } catch (error) {
        console.error('Error fetching assets:', error);
        res.status(500).json({ error: 'Error fetching assets' });
    }
});

// Reload endpoint to force front end refresh
app.post('/api/reload', (req, res) => {
    try {
        const { houseId } = req.body;
        if (!houseId) {
            return res.status(400).json({ error: 'houseId is required' });
        }
        
        // Clear any cached data if needed
        // For now, we'll just return success as the front end will fetch fresh data
        res.json({ message: 'Reload triggered successfully' });
    } catch (error) {
        console.error('Error triggering reload:', error);
        res.status(500).json({ error: 'Failed to trigger reload' });
    }
});

// Serve main page
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    console.log('Serving main page from:', indexPath);
    res.sendFile(indexPath);
});

// Serve admin panel
app.get('/admin', (req, res) => {
    const adminPath = path.join(__dirname, 'admin', 'index.html');
    console.log('Serving admin panel from:', adminPath);
    res.sendFile(adminPath);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).send('Something broke!');
});

// 404 handler
app.use((req, res) => {
    console.log('404 Not Found:', req.url);
    res.status(404).send('Not Found');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Admin panel available at: http://localhost:${PORT}/admin`);
    console.log('Current directory:', __dirname);
}); 