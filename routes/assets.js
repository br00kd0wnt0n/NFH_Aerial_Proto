const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Asset = require('../models/asset');

// Configure multer for video uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (!file.mimetype.startsWith('video/')) {
            return cb(new Error('Only video files are allowed!'), false);
        }
        cb(null, true);
    },
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

// Get assets for a house
router.get('/', async (req, res) => {
    try {
        const { houseId } = req.query;
        if (!houseId) {
            return res.status(400).json({ error: 'houseId is required' });
        }

        console.log('Fetching assets for houseId:', houseId);
        const assets = await Asset.find({ houseId: parseInt(houseId) });
        console.log('Found assets:', assets);
        
        res.json({ assets });
    } catch (error) {
        console.error('Error fetching assets:', error);
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
});

// Upload a new asset
router.post('/', upload.single('assetFile'), async (req, res) => {
    try {
        console.log('Received asset upload request:', {
            file: req.file,
            body: req.body
        });

        const { houseId, type } = req.body;
        
        if (!req.file) {
            console.error('No file uploaded');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (!houseId) {
            console.error('houseId is missing');
            return res.status(400).json({ error: 'houseId is required' });
        }

        if (!type) {
            console.error('type is missing');
            return res.status(400).json({ error: 'type is required' });
        }

        // Validate asset type
        const validTypes = ['aerial', 'diveIn', 'zoomOut', 'hotspot', 'floorLevel'];
        if (!validTypes.includes(type)) {
            console.error('Invalid asset type:', type);
            return res.status(400).json({ error: 'Invalid asset type' });
        }

        // Delete existing asset of the same type if it exists
        const query = { houseId: parseInt(houseId), type };
        await Asset.deleteMany(query);

        // Create new asset with default playback rules
        const asset = new Asset({
            name: req.file.originalname,
            type,
            url: `/uploads/${req.file.filename}`,
            houseId: parseInt(houseId),
            playbackRules: {
                loop: type === 'aerial',
                autoplay: true,
                muted: true
            }
        });

        console.log('Saving new asset:', asset);
        await asset.save();
        console.log('Asset saved successfully');
        res.json({ asset });
    } catch (error) {
        console.error('Error uploading asset:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete an asset
router.delete('/:id', async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id);
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        // Delete the file from the filesystem
        const filePath = path.join(__dirname, '..', asset.url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('Deleted file:', filePath);
        } else {
            console.log('File not found:', filePath);
        }

        // Delete from database
        await asset.deleteOne();
        console.log('Deleted asset from database:', asset._id);

        res.json({ message: 'Asset deleted successfully' });
    } catch (error) {
        console.error('Error deleting asset:', error);
        res.status(500).json({ error: 'Failed to delete asset' });
    }
});

module.exports = router; 