const express = require('express');
const router = express.Router();
const Playlist = require('../models/playlist');

// Get playlists for a house
router.get('/', async (req, res) => {
    try {
        const { houseId } = req.query;
        if (!houseId) {
            return res.status(400).json({ error: 'houseId is required' });
        }

        console.log('Fetching playlists for houseId:', houseId);
        
        // Find or create playlist for this house
        let playlist = await Playlist.findOne({ houseId: parseInt(houseId) });
        
        if (!playlist) {
            // Create a new empty playlist for this house
            playlist = new Playlist({
                houseId: parseInt(houseId),
                hotspots: new Map()
            });
            await playlist.save();
            console.log('Created new playlist for house:', houseId);
        }

        // Convert Map to object for JSON response
        const playlists = {};
        playlist.hotspots.forEach((value, key) => {
            playlists[key] = {
                diveIn: value.diveIn || { videoId: null },
                floorLevel: value.floorLevel || { videoId: null },
                zoomOut: value.zoomOut || { videoId: null }
            };
        });

        res.json({ playlists });
    } catch (error) {
        console.error('Error fetching playlists:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save playlists for a house
router.post('/', async (req, res) => {
    try {
        const { houseId, playlists } = req.body;
        console.log('Saving playlists for houseId:', houseId);
        console.log('Playlists data:', playlists);
        
        if (!houseId || !playlists || typeof playlists !== 'object') {
            return res.status(400).json({ error: 'Invalid request data' });
        }

        // Find or create playlist for this house
        let playlist = await Playlist.findOne({ houseId: parseInt(houseId) });
        
        if (!playlist) {
            playlist = new Playlist({
                houseId: parseInt(houseId),
                hotspots: new Map()
            });
        }

        // Update hotspots map
        Object.entries(playlists).forEach(([hotspotId, videos]) => {
            playlist.hotspots.set(hotspotId, {
                diveIn: videos.diveIn || { videoId: null },
                floorLevel: videos.floorLevel || { videoId: null },
                zoomOut: videos.zoomOut || { videoId: null }
            });
        });

        await playlist.save();
        console.log('Saved playlists:', playlist);

        // Convert Map to object for response
        const responsePlaylists = {};
        playlist.hotspots.forEach((value, key) => {
            responsePlaylists[key] = {
                diveIn: value.diveIn || { videoId: null },
                floorLevel: value.floorLevel || { videoId: null },
                zoomOut: value.zoomOut || { videoId: null }
            };
        });

        res.json({ playlists: responsePlaylists });
    } catch (error) {
        console.error('Error saving playlists:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update a specific hotspot's playlist
router.patch('/:houseId/hotspots/:hotspotId', async (req, res) => {
    try {
        const { houseId, hotspotId } = req.params;
        const { videos } = req.body;

        if (!videos || typeof videos !== 'object') {
            return res.status(400).json({ error: 'Invalid request data' });
        }

        // Find playlist for this house
        let playlist = await Playlist.findOne({ houseId: parseInt(houseId) });
        
        if (!playlist) {
            playlist = new Playlist({
                houseId: parseInt(houseId),
                hotspots: new Map()
            });
        }

        // Update specific hotspot's videos
        playlist.hotspots.set(hotspotId, {
            diveIn: videos.diveIn || { videoId: null },
            floorLevel: videos.floorLevel || { videoId: null },
            zoomOut: videos.zoomOut || { videoId: null }
        });

        await playlist.save();
        console.log('Updated playlist for hotspot:', hotspotId);

        // Convert Map to object for response
        const responsePlaylists = {};
        playlist.hotspots.forEach((value, key) => {
            responsePlaylists[key] = {
                diveIn: value.diveIn || { videoId: null },
                floorLevel: value.floorLevel || { videoId: null },
                zoomOut: value.zoomOut || { videoId: null }
            };
        });

        res.json({ playlists: responsePlaylists });
    } catch (error) {
        console.error('Error updating hotspot playlist:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 