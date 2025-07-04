const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  name: String,
  content: String,
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

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
  status: { type: String, default: 'pending' },
  replies: [replySchema] // Thêm mảng replies
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
