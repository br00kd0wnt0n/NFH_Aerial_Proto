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
    // Log the full request details with timestamp
    console.log('=== Video Proxy Request ===', new Date().toISOString());
    console.log('Request details:', {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        params: req.params,
        query: req.query,
        headers: {
            range: req.headers.range,
            accept: req.headers.accept,
            'user-agent': req.headers['user-agent']
        }
    });

    // Add request timeout
    req.setTimeout(30000); // 30 seconds timeout

    try {
        const assetId = req.params.id;
        console.log('Processing video request for asset ID:', assetId);
        
        // Validate asset ID format
        if (!assetId.match(/^[0-9a-fA-F]{24}$/)) {
            console.error('Invalid asset ID format:', assetId);
            return res.status(400).json({ 
                error: 'Invalid asset ID format',
                details: 'Asset ID must be a valid MongoDB ObjectId'
            });
        }

        const asset = await Asset.findById(assetId);
        if (!asset) {
            console.error('Asset not found in database:', assetId);
            return res.status(404).json({ 
                error: 'Asset not found',
                details: 'No asset found with the provided ID'
            });
        }

        // Log detailed asset information
        console.log('Found asset in database:', {
            id: asset._id,
            name: asset.name,
            url: asset.url,
            type: asset.type,
            createdAt: asset.createdAt,
            originalName: asset.originalName,
            mimeType: asset.mimeType,
            size: asset.size,
            houseId: asset.houseId,
            playbackRules: asset.playbackRules
        });

        // Validate asset URL
        if (!asset.url) {
            console.error('Asset has no URL:', asset._id);
            return res.status(500).json({ 
                error: 'Invalid asset configuration',
                details: 'Asset has no URL configured'
            });
        }

        // Extract S3 key from URL
        let key;
        try {
            const s3Url = new URL(asset.url);
            key = s3Url.pathname.slice(1); // Remove leading slash
            console.log('Extracted S3 key:', {
                key,
                bucket: s3Url.hostname.split('.')[0],
                region: s3Url.hostname.split('.')[1],
                fullUrl: asset.url
            });
            
            // Log file extension from key
            const extension = path.extname(key).toLowerCase();
            console.log('File extension from S3 key:', extension);
        } catch (urlError) {
            console.error('Failed to parse asset URL:', {
                url: asset.url,
                error: urlError.message,
                stack: urlError.stack
            });
            return res.status(500).json({ 
                error: 'Invalid asset URL format',
                details: urlError.message
            });
        }

        // Validate S3 configuration
        if (!process.env.AWS_BUCKET_NAME) {
            console.error('AWS_BUCKET_NAME not configured');
            return res.status(500).json({ 
                error: 'Server configuration error',
                details: 'S3 bucket not configured'
            });
        }

        // Get the video stream from S3
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key
        });

        console.log('Sending GetObjectCommand to S3:', {
            bucket: process.env.AWS_BUCKET_NAME,
            key: key,
            command: 'GetObject',
            assetId: asset._id
        });

        try {
            const response = await s3Client.send(command);
            console.log('S3 response received:', {
                contentLength: response.ContentLength,
                contentType: response.ContentType,
                lastModified: response.LastModified,
                metadata: response.Metadata,
                requestId: response.$metadata?.requestId,
                acceptRanges: response.AcceptRanges,
                etag: response.ETag,
                assetId: asset._id
            });

            if (!response.Body) {
                console.error('S3 response has no body:', {
                    assetId: asset._id,
                    key: key,
                    bucket: process.env.AWS_BUCKET_NAME
                });
                return res.status(500).json({ 
                    error: 'Invalid S3 response',
                    details: 'S3 response has no body'
                });
            }

            // Determine content type from S3 response or file extension
            let contentType = response.ContentType;
            if (!contentType) {
                const extension = path.extname(key).toLowerCase();
                switch (extension) {
                    case '.mp4':
                        contentType = 'video/mp4';
                        break;
                    case '.webm':
                        contentType = 'video/webm';
                        break;
                    case '.mov':
                        contentType = 'video/quicktime';
                        break;
                    default:
                        contentType = 'video/mp4'; // Default to mp4
                }
            }
            console.log('Using content type:', {
                contentType,
                file: key,
                assetId: asset._id,
                originalContentType: response.ContentType,
                extension: path.extname(key).toLowerCase()
            });
            
            // Set appropriate headers
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', response.ContentLength);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            res.setHeader('X-Content-Type-Options', 'nosniff');

            // Log browser compatibility
            const userAgent = req.headers['user-agent'] || '';
            console.log('Browser info:', {
                userAgent,
                acceptsVideo: req.headers.accept?.includes('video/'),
                contentType,
                contentLength: response.ContentLength,
                assetId: asset._id
            });

            // Handle range requests for video streaming
            const range = req.headers.range;
            if (range) {
                console.log('Processing range request:', range);
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : response.ContentLength - 1;
                const chunksize = (end - start) + 1;

                if (start >= response.ContentLength || end >= response.ContentLength) {
                    console.error('Invalid range request:', { 
                        start, 
                        end, 
                        contentLength: response.ContentLength 
                    });
                    return res.status(416).json({ 
                        error: 'Requested range not satisfiable',
                        details: `Range ${start}-${end} exceeds content length ${response.ContentLength}`
                    });
                }

                res.setHeader('Content-Range', `bytes ${start}-${end}/${response.ContentLength}`);
                res.setHeader('Content-Length', chunksize);
                res.status(206);

                try {
                    // Create a read stream for the requested range
                    const stream = response.Body;
                    const chunks = [];
                    
                    for await (const chunk of stream) {
                        chunks.push(chunk);
                    }
                    
                    const buffer = Buffer.concat(chunks);
                    const chunk = buffer.slice(start, end + 1);
                    console.log('Sending range response:', {
                        start,
                        end,
                        chunkSize: chunk.length,
                        totalSize: response.ContentLength
                    });
                    res.send(chunk);
                } catch (streamError) {
                    console.error('Error processing video stream:', {
                        error: streamError.message,
                        start,
                        end,
                        contentLength: response.ContentLength,
                        stack: streamError.stack
                    });
                    throw streamError;
                }
            } else {
                // Stream the entire file
                try {
                    const stream = response.Body;
                    if (stream instanceof Readable) {
                        stream.on('error', (streamError) => {
                            console.error('Stream error:', {
                                error: streamError.message,
                                stack: streamError.stack
                            });
                            if (!res.headersSent) {
                                res.status(500).json({ 
                                    error: 'Error streaming video',
                                    details: streamError.message
                                });
                            }
                        });
                        console.log('Starting full video stream');
                        stream.pipe(res);
                    } else {
                        console.log('Converting non-Readable stream to Readable');
                        // If not a Readable stream, convert it
                        const readableStream = new Readable({
                            read() {
                                try {
                                    this.push(stream);
                                    this.push(null);
                                } catch (error) {
                                    console.error('Error in readable stream:', {
                                        error: error.message,
                                        stack: error.stack
                                    });
                                    this.destroy(error);
                                }
                            }
                        });
                        readableStream.on('error', (streamError) => {
                            console.error('Readable stream error:', {
                                error: streamError.message,
                                stack: streamError.stack
                            });
                            if (!res.headersSent) {
                                res.status(500).json({ 
                                    error: 'Error streaming video',
                                    details: streamError.message
                                });
                            }
                        });
                        readableStream.pipe(res);
                    }
                } catch (streamError) {
                    console.error('Error setting up video stream:', {
                        error: streamError.message,
                        stack: streamError.stack
                    });
                    throw streamError;
                }
            }
        } catch (s3Error) {
            console.error('S3 operation failed:', {
                error: s3Error.message,
                code: s3Error.code,
                requestId: s3Error.$metadata?.requestId,
                bucket: process.env.AWS_BUCKET_NAME,
                key: key,
                stack: s3Error.stack
            });
            throw s3Error;
        }
    } catch (error) {
        console.error('Error streaming video:', {
            error: error.message,
            code: error.code,
            stack: error.stack,
            assetId: req.params.id,
            timestamp: new Date().toISOString()
        });
        
        // Send appropriate error response
        if (error.code === 'NoSuchKey') {
            res.status(404).json({ 
                error: 'Video not found in S3',
                details: error.message
            });
        } else if (error.code === 'AccessDenied') {
            res.status(403).json({ 
                error: 'Access denied to video',
                details: error.message
            });
        } else if (error.code === 'NetworkingError') {
            res.status(503).json({ 
                error: 'S3 service unavailable',
                details: error.message
            });
        } else {
            res.status(500).json({ 
                error: 'Error streaming video',
                details: error.message,
                code: error.code
            });
        }
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

        // Log detailed file information
        console.log('Uploaded file details:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            location: req.file.location,
            key: req.file.key,
            bucket: req.file.bucket,
            metadata: req.file.metadata,
            contentType: req.file.contentType
        });

        const { houseId, type, name } = req.body;
        const asset = new Asset({
            houseId,
            type,
            name: name || req.file.originalname,
            url: req.file.location,
            originalName: req.file.originalname, // Store original filename
            mimeType: req.file.mimetype, // Store mime type
            size: req.file.size, // Store file size
            playbackRules: {
                loop: true,
                autoplay: true,
                muted: true
            }
        });

        await asset.save();
        console.log('Asset saved to database:', {
            id: asset._id,
            name: asset.name,
            type: asset.type,
            url: asset.url,
            mimeType: asset.mimeType,
            size: asset.size
        });
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