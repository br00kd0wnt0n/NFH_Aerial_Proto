// Load environment variables first, before any other requires
require('dotenv').config();

// Log all environment variables (safely)
console.log('Environment Variables Status:');
const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    MONGODB_URI: process.env.MONGODB_URI ? '[HIDDEN]' : 'not set',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? '[HIDDEN]' : 'not set',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? '[HIDDEN]' : 'not set',
    AWS_REGION: process.env.AWS_REGION || 'not set',
    AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME || 'not set'
};

console.log('Environment Variables:', JSON.stringify(envVars, null, 2));

const express = require('express');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const assetRoutes = require('./routes/assets');
const hotspotRoutes = require('./routes/hotspots');
const playlistRoutes = require('./routes/playlists');

// Import models - use existing models from routes
const Asset = mongoose.models.Asset || require('./models/asset');

const app = express();
const upload = multer();

// Set environment
const isProduction = process.env.NODE_ENV === 'production';

// Security headers middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    if (isProduction) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// Middleware
app.use(cors({
    origin: isProduction 
        ? ['https://nfhaerialproto-production.up.railway.app', 'https://www.netflixhouse.com'] 
        : 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Debug middleware to log requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (!isProduction) {
        console.log('Request headers:', req.headers);
    }
    next();
});

// Add request logging middleware
app.use((req, res, next) => {
    console.log('=== Incoming Request ===', new Date().toISOString());
    console.log({
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        params: req.params,
        headers: {
            range: req.headers.range,
            accept: req.headers.accept,
            'user-agent': req.headers['user-agent']
        }
    });

    // Log response
    const originalSend = res.send;
    res.send = function (body) {
        console.log('=== Outgoing Response ===', new Date().toISOString());
        console.log({
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            headers: res.getHeaders()
        });
        if (res.statusCode >= 400) {
            console.error('Error response body:', body);
        }
        return originalSend.call(this, body);
    };

    next();
});

// Serve static files
app.use('/admin', express.static(path.join(__dirname, 'admin'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));
app.use(express.static('public'));

// Environment variables
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/netflix-house';

// Connect to MongoDB
const connectWithRetry = async () => {
    try {
        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        // Log connection attempt (without credentials)
        const sanitizedUri = MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@');
        console.log('Attempting to connect to MongoDB:', sanitizedUri);

        // First try direct MongoDB connection
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('Direct MongoDB connection successful');
        await client.close();

        // Then connect with Mongoose
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            retryWrites: true,
            w: 'majority',
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('Connected to MongoDB Atlas with Mongoose');
        
        // Start server only after successful database connection
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);
            console.log(`Admin panel available at: ${isProduction ? 'https://nfhaerialproto-production.up.railway.app/admin' : `http://localhost:${PORT}/admin`}`);
            console.log('Current directory:', __dirname);
        });
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        if (err.message.includes('authentication failed')) {
            console.error('Authentication failed. Please check your MongoDB username and password in the MONGODB_URI environment variable.');
        }
        console.log('Retrying connection in 5 seconds...');
        setTimeout(connectWithRetry, 5000);
    }
};

// Initial connection attempt
connectWithRetry();

// Add connection error handler
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err.message);
    if (err.message.includes('authentication failed')) {
        console.error('Authentication failed. Please check your MongoDB username and password in the MONGODB_URI environment variable.');
    }
    console.log('Attempting to reconnect...');
    setTimeout(connectWithRetry, 5000);
});

// Add disconnection handler
mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected. Attempting to reconnect...');
    setTimeout(connectWithRetry, 5000);
});

// Add reconnection handler
mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
});

// House Video Schema - for house-specific videos
const houseVideoSchema = new mongoose.Schema({
    houseId: { type: Number, required: true, unique: true },
    aerial: { videoId: String },  // House's aerial video
    transitions: {
        toHouse1: { videoId: String },  // Transition video when switching to House 1
        toHouse2: { videoId: String }   // Transition video when switching to House 2
    }
});

// Hotspot Video Schema - for hotspot-specific videos
const hotspotVideoSchema = new mongoose.Schema({
    houseId: { type: Number, required: true },
    hotspotId: { type: String, required: true },
    diveIn: { videoId: String },
    floorLevel: { videoId: String },
    zoomOut: { videoId: String }
});

// Create compound index for hotspot videos
hotspotVideoSchema.index({ houseId: 1, hotspotId: 1 }, { unique: true });

const HouseVideo = mongoose.model('HouseVideo', houseVideoSchema);
const HotspotVideo = mongoose.model('HotspotVideo', hotspotVideoSchema);

// Global Videos Schema
const globalVideosSchema = new mongoose.Schema({
    kopAerial: { videoId: String },
    dallasAerial: { videoId: String },
    kopToDallas: { videoId: String },
    dallasToKop: { videoId: String }
}, { _id: false });

const GlobalVideos = mongoose.model('GlobalVideos', globalVideosSchema);

// Initialize global videos if they don't exist
async function initializeGlobalVideos() {
    try {
        const count = await GlobalVideos.countDocuments();
        if (count === 0) {
            await GlobalVideos.create({});
            console.log('Initialized global videos document');
        }
    } catch (error) {
        console.error('Error initializing global videos:', error);
    }
}

// Call initialization
initializeGlobalVideos();

// Routes
// Get house videos
app.get('/api/house-videos', async (req, res) => {
    try {
        const houseId = parseInt(req.query.houseId);
        if (!houseId) {
            return res.status(400).json({ error: 'House ID is required' });
        }

        let houseVideo = await HouseVideo.findOne({ houseId });
        if (!houseVideo) {
            // Initialize with empty structure
            houseVideo = new HouseVideo({
                houseId,
                aerial: { videoId: null },
                transitions: {
                    toHouse1: { videoId: null },
                    toHouse2: { videoId: null }
                }
            });
            await houseVideo.save();
        }

        res.json({ houseVideo });
    } catch (error) {
        console.error('Error fetching house videos:', error);
        res.status(500).json({ error: 'Failed to fetch house videos' });
    }
});

// Update house videos
app.post('/api/house-videos', async (req, res) => {
    try {
        const { houseId, houseVideo } = req.body;
        if (!houseId) {
            return res.status(400).json({ error: 'House ID is required' });
        }

        let existingVideo = await HouseVideo.findOne({ houseId: parseInt(houseId) });
        if (existingVideo) {
            existingVideo.set(houseVideo);
            await existingVideo.save();
        } else {
            existingVideo = new HouseVideo({ houseId: parseInt(houseId), ...houseVideo });
            await existingVideo.save();
        }

        res.json({ houseVideo: existingVideo });
    } catch (error) {
        console.error('Error updating house videos:', error);
        res.status(500).json({ error: 'Failed to update house videos' });
    }
});

// Get hotspot videos
app.get('/api/hotspot-videos', async (req, res) => {
    try {
        const { houseId, hotspotId } = req.query;
        if (!houseId) {
            console.error('GET /api/hotspot-videos: Missing houseId in request');
            return res.status(400).json({ error: 'House ID is required' });
        }

        const query = { houseId: parseInt(houseId) };
        if (hotspotId) {
            query.hotspotId = hotspotId;
        }
        console.log("GET /api/hotspot-videos - Request query:", query);
        console.log("GET /api/hotspot-videos - Request params:", req.query);
        
        // If hotspotId is provided, use findOne (return a single object) else use find (return an array)
        let hotspotVideos = hotspotId ? await HotspotVideo.findOne(query) : await HotspotVideo.find(query);
        console.log("GET /api/hotspot-videos - Database query result:", JSON.stringify(hotspotVideos, null, 2));
        
        if (hotspotId && !hotspotVideos) {
            console.log("GET /api/hotspot-videos - No videos found for hotspot, creating default structure");
            hotspotVideos = { diveIn: { videoId: null }, floorLevel: { videoId: null }, zoomOut: { videoId: null } };
        }
        
        // If hotspotId is provided, wrap hotspotVideos in an object
        if (hotspotId) {
            hotspotVideos = { hotspotVideos };
        }
        console.log("GET /api/hotspot-videos - Final response:", JSON.stringify(hotspotVideos, null, 2));
        res.json(hotspotId ? hotspotVideos : { hotspotVideos });
    } catch (error) {
        console.error('Error fetching hotspot videos:', error);
        res.status(500).json({ error: 'Failed to fetch hotspot videos' });
    }
});

// Update hotspot videos
app.post('/api/hotspot-videos', async (req, res) => {
    try {
        const { houseId, hotspotId, videos } = req.body;
        if (!houseId || !hotspotId) {
            return res.status(400).json({ error: 'House ID and Hotspot ID are required' });
        }

        let existingVideos = await HotspotVideo.findOne({
            houseId: parseInt(houseId),
            hotspotId
        });

        if (existingVideos) {
            existingVideos.set(videos);
            await existingVideos.save();
        } else {
            existingVideos = new HotspotVideo({
                houseId: parseInt(houseId),
                hotspotId,
                ...videos
            });
            await existingVideos.save();
        }

        res.json({ hotspotVideos: existingVideos });
    } catch (error) {
        console.error('Error updating hotspot videos:', error);
        res.status(500).json({ error: 'Failed to update hotspot videos' });
    }
});

// Get global videos
app.get('/api/global-videos', async (req, res) => {
    try {
        // Get the single global video document
        const globalVideo = await GlobalVideos.findOne();
        
        // If no document exists, return empty structure
        if (!globalVideo) {
            return res.json({
                globalVideos: {
                    welcome: null,
                    exit: null,
                    error: null
                }
            });
        }

        // Return the global videos
        res.json({ globalVideos: globalVideo.globalVideos || {} });
    } catch (error) {
        console.error('Error fetching global videos:', error);
        res.status(500).json({ error: 'Failed to fetch global videos' });
    }
});

// Update global videos
app.post('/api/global-videos', async (req, res) => {
    try {
        const { type, videoId } = req.body;
        
        if (!type || !videoId) {
            console.error('Missing required fields:', { type, videoId });
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log('Updating global video:', { type, videoId });

        // Get the asset to verify it exists and get its name
        const asset = await Asset.findById(videoId);
        if (!asset) {
            console.error('Video asset not found:', videoId);
            return res.status(404).json({ error: 'Video asset not found' });
        }

        // Update or create the global video entry
        const update = {
            $set: {
                [`globalVideos.${type}`]: {
                    videoId,
                    name: asset.name,
                    url: asset.url,
                    updatedAt: new Date()
                }
            }
        };

        console.log('Update operation:', update);

        // Use upsert to create if doesn't exist
        const result = await GlobalVideos.findOneAndUpdate(
            {}, // No query - we want the single global video document
            update,
            { upsert: true, new: true }
        );

        console.log('Updated global video result:', result);
        res.json(result);
    } catch (error) {
        console.error('Error updating global video:', error);
        res.status(500).json({ error: 'Failed to update global video', details: error.message });
    }
});

// Asset and hotspot routes
app.use('/api/assets', assetRoutes);
app.use('/api/hotspots', hotspotRoutes);
app.use('/api/playlists', playlistRoutes);

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

// Serve admin panel
app.get('/admin', (req, res) => {
    const adminPath = path.join(__dirname, 'admin', 'index.html');
    console.log('Attempting to serve admin panel from:', adminPath);
    if (require('fs').existsSync(adminPath)) {
        console.log('Admin panel file exists, sending...');
        res.sendFile(adminPath);
    } else {
        console.error('Admin panel file not found at:', adminPath);
        res.status(404).send('Admin panel not found');
    }
});

// Serve main page
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    console.log('Serving main page from:', indexPath);
    res.sendFile(indexPath);
});

// Disable caching for all API responses
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('=== Unhandled Error ===', new Date().toISOString());
    console.error({
        error: err.message,
        stack: err.stack,
        code: err.code,
        url: req.url,
        method: req.method,
        headers: req.headers
    });

    // Don't expose internal errors to client
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? 'Internal Server Error' : err.message;
    
    res.status(statusCode).json({
        error: message,
        code: err.code,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    console.log('404 Not Found:', req.url);
    res.status(404).send('Not Found');
}); 