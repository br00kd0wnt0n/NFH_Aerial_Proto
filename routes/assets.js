const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const Asset = require('../models/asset');
const { upload, s3Client } = require('../config/s3');
const { DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

// Video proxy route
router.get('/video/:id', async (req, res) => {
    try {
        console.log('Video proxy request for asset ID:', req.params.id);
        
        const asset = await Asset.findById(req.params.id);
        if (!asset) {
            console.error('Asset not found:', req.params.id);
            return res.status(404).json({ error: 'Asset not found' });
        }

        console.log('Found asset:', {
            id: asset._id,
            name: asset.name,
            url: asset.url
        });

        // Extract S3 key from URL
        const s3Url = new URL(asset.url);
        const key = s3Url.pathname.slice(1); // Remove leading slash
        console.log('S3 key:', key);

        // Get the video stream from S3
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key
        });

        console.log('Sending GetObjectCommand to S3:', {
            bucket: process.env.AWS_BUCKET_NAME,
            key: key
        });

        try {
            const response = await s3Client.send(command);
            console.log('S3 response received:', {
                contentLength: response.ContentLength,
                contentType: response.ContentType,
                lastModified: response.LastModified
            });
            
            // Set appropriate headers
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Length', response.ContentLength);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'public, max-age=31536000');

            // Handle range requests for video streaming
            const range = req.headers.range;
            if (range) {
                console.log('Range request:', range);
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : response.ContentLength - 1;
                const chunksize = (end - start) + 1;

                res.setHeader('Content-Range', `bytes ${start}-${end}/${response.ContentLength}`);
                res.setHeader('Content-Length', chunksize);
                res.status(206);

                // Create a read stream for the requested range
                const stream = response.Body;
                const chunks = [];
                
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                
                const buffer = Buffer.concat(chunks);
                const chunk = buffer.slice(start, end + 1);
                res.send(chunk);
            } else {
                // Stream the entire file
                const stream = response.Body;
                if (stream instanceof Readable) {
                    stream.pipe(res);
                } else {
                    // If not a Readable stream, convert it
                    const readableStream = new Readable({
                        read() {
                            this.push(stream);
                            this.push(null);
                        }
                    });
                    readableStream.pipe(res);
                }
            }
        } catch (s3Error) {
            console.error('S3 operation failed:', {
                error: s3Error.message,
                code: s3Error.code,
                requestId: s3Error.$metadata?.requestId,
                bucket: process.env.AWS_BUCKET_NAME,
                key: key
            });
            throw s3Error;
        }
    } catch (error) {
        console.error('Error streaming video:', {
            error: error.message,
            code: error.code,
            stack: error.stack,
            assetId: req.params.id
        });
        res.status(500).json({ 
            error: 'Error streaming video',
            details: error.message,
            code: error.code
        });
    }
});

// Get assets for a house
router.get('/', async (req, res) => {
    try {
        const { houseId } = req.query;
        const assets = await Asset.find({ houseId });
        
        // Modify asset URLs to use our proxy
        const modifiedAssets = assets.map(asset => ({
            ...asset.toObject(),
            url: `/api/assets/video/${asset._id}`
        }));
        
        res.json({ assets: modifiedAssets });
    } catch (error) {
        console.error('Error fetching assets:', error);
        res.status(500).json({ error: 'Error fetching assets' });
    }
});

// Upload new asset
router.post('/', upload.single('asset'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { houseId, type, name } = req.body;
        const asset = new Asset({
            houseId,
            type,
            name: name || req.file.originalname,
            url: req.file.location,
            playbackRules: {
                loop: true,
                autoplay: true,
                muted: true
            }
        });

        await asset.save();
        res.json(asset);
    } catch (error) {
        console.error('Error uploading asset:', error);
        res.status(500).json({ error: 'Error uploading asset' });
    }
});

// Delete asset
router.delete('/:id', async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id);
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        // Extract S3 key from URL
        const s3Url = new URL(asset.url);
        const key = s3Url.pathname.slice(1); // Remove leading slash

        // Delete file from S3
        try {
            await s3Client.send(new DeleteObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: key
            }));
        } catch (s3Error) {
            // If file doesn't exist in S3, just log it and continue with DB deletion
            console.warn(`File not found in S3 for asset ${asset._id}:`, s3Error);
        }

        // Delete from MongoDB
        await Asset.findByIdAndDelete(req.params.id);
        res.json({ message: 'Asset deleted successfully' });
    } catch (error) {
        console.error('Error deleting asset:', error);
        res.status(500).json({ error: 'Error deleting asset' });
    }
});

// Update asset
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;

        // Validate type
        if (!['aerial', 'diveIn', 'floorLevel', 'zoomOut', 'transition'].includes(type)) {
            return res.status(400).json({ error: 'Invalid asset type' });
        }

        const asset = await Asset.findById(id);
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        // Update asset type
        asset.type = type;
        await asset.save();

        res.json(asset);
    } catch (error) {
        console.error('Error updating asset:', error);
        res.status(500).json({ error: 'Failed to update asset' });
    }
});

module.exports = router; 