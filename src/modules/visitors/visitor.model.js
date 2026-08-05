import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema({
  ip: { type: String },
  ipLocation: {
    city: { type: String },
    region: { type: String },
    country: { type: String },
    lat: { type: Number },
    lon: { type: Number },
  },
  preciseLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number }, // meters, from the browser Geolocation API
  },
  locationPermission: {
    type: String,
    enum: ['granted', 'denied', 'unavailable', 'not_requested'],
    default: 'not_requested',
  },
  userAgent: { type: String },
  referrer: { type: String },
  path: { type: String },
  language: { type: String },
  timezone: { type: String },
  screenWidth: { type: Number },
  screenHeight: { type: Number },
  visitedAt: { type: Date, default: Date.now },
});

export default mongoose.model('Visitor', visitorSchema);
