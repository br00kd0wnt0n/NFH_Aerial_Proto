const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
    name: String,
    type: {
        type: String,
        enum: ['aerial', 'diveIn', 'zoomOut', 'hotspot', 'floorLevel', 'transition'],
        required: true
    },
    url: String,
    houseId: {
        type: Number,
        required: function() {
            // Only require houseId for non-global videos
            return this.type !== 'aerial' && this.type !== 'transition';
        }
    },
    hotspotId: {
        type: String,
        required: function() {
            return this.type === 'hotspot';
        }
    },
    playbackRules: {
        loop: {
            type: Boolean,
            default: function() {
                // Aerial videos loop by default, others don't
                return this.type === 'aerial';
            }
        },
        autoplay: {
            type: Boolean,
            default: true
        },
        muted: {
            type: Boolean,
            default: true
        }
    }
});

module.exports = mongoose.model('Asset', assetSchema); 