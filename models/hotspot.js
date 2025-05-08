const mongoose = require('mongoose');

const hotspotSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['primary', 'secondary']
    },
    points: [{
        x: {
            type: Number,
            required: true
        },
        y: {
            type: Number,
            required: true
        }
    }],
    description: {
        type: String,
        default: ''
    },
    houseId: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Hotspot', hotspotSchema); 