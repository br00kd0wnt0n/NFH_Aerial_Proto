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
            
            const filenameLower = asset.name.toLowerCase();
            let newType = asset.type; // Default to current type

            // Determine type based on filename patterns
            if (filenameLower.includes('dive') || filenameLower.includes('transition')) {
                newType = 'diveIn';
            } else if (filenameLower.includes('floor') || filenameLower.includes('level')) {
                newType = 'floorLevel';
            } else if (filenameLower.includes('zoom') || filenameLower.includes('out')) {
                newType = 'zoomOut';
            } else if (filenameLower.includes('map') || filenameLower.includes('aerial')) {
                newType = 'aerial';
            }

            // Only update if type has changed
            if (newType !== asset.type) {
                console.log(`  Updating type from ${asset.type} to ${newType}`);
                asset.type = newType;
                await asset.save();
                console.log(`  Updated asset in DB: ${asset._id}`);
            } else {
                console.log(`  Type already correct: ${asset.type}`);
            }
        }

        console.log('\nAsset type update completed successfully');
    } catch (error) {
        console.error('Update failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

updateAssetTypes(); 