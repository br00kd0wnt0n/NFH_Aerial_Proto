const mongoose = require('mongoose');
require('dotenv').config();

const Asset = require('../models/asset');

async function updateAssetTypes() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/netflix-house');
        console.log('Connected to MongoDB');

        // Get all assets
        const assets = await Asset.find({});
        console.log(`Found ${assets.length} assets to update`);

        for (const asset of assets) {
            console.log(`\nChecking asset: ${asset._id}`);
            console.log(`  Name: ${asset.name}`);
            console.log(`  Current Type: ${asset.type}`);
            
            // Always normalize type to lowercase
            let newType = asset.type ? asset.type.toLowerCase() : '';
            const filenameLower = asset.name ? asset.name.toLowerCase() : '';

            // Determine type based on filename patterns if needed
            if (filenameLower.includes('dive') || filenameLower.includes('transition')) {
                newType = 'divein';
            } else if (filenameLower.includes('floor') || filenameLower.includes('level')) {
                newType = 'floorlevel';
            } else if (filenameLower.includes('zoom') || filenameLower.includes('out')) {
                newType = 'zoomout';
            } else if (filenameLower.includes('map') || filenameLower.includes('aerial')) {
                newType = 'aerial';
            }

            // Always update type if not normalized
            if (asset.type !== newType) {
                console.log(`  Updating type from ${asset.type} to ${newType}`);
                asset.type = newType;
            }

            // Skip and warn if missing houseId
            if (!asset.houseId) {
                console.warn(`  Skipping asset ${asset._id} (${asset.name}) - missing houseId`);
                continue;
            }

            try {
                await asset.save();
                console.log(`  Updated asset in DB: ${asset._id}`);
            } catch (err) {
                console.error(`  Failed to update asset ${asset._id}:`, err.message);
            }
        }

        console.log('\nAsset type update completed successfully');
    } catch (error) {
        console.error('Update failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Run the update
updateAssetTypes(); 