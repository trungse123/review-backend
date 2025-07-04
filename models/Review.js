const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: String,
  phone: String,
  email: String,
  title: String,
  content: String,
  rating: Number,
  imageUrls: [String],
  videoUrl: String,
  isPurchased: { type: Boolean, default: false },
  status: { type: String, default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
