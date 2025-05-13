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
        required: true
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