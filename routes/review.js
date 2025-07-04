const express = require('express');
const multer = require('multer');
const path = require('path');
const Review = require('../models/Review');
const { hasPurchasedProduct } = require('../utils/haravan');

const router = express.Router();

// Cấu hình lưu file upload local
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random()*1E9) + ext);
  }
});
const upload = multer({ storage });

// API gửi review mới, cho upload tối đa 5 ảnh, 1 video
router.post(
  '/create',
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'video', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { productId, name, phone, email, title, content, rating } = req.body;
      if (!name || !phone || !content) {
        return res.status(400).json({ message: 'Họ tên, SĐT và nội dung là bắt buộc!' });
      }

      // Chống spam (10s)
      const lastReview = await Review.findOne({ phone, productId }).sort({ createdAt: -1 });
      if (lastReview && (Date.now() - lastReview.createdAt.getTime() < 10000)) {
        return res.status(429).json({ message: 'Vui lòng đợi 10s trước khi gửi tiếp!' });
      }

      // Kiểm tra đã mua hàng (có thể bỏ nếu không cần)
      const isPurchased = await hasPurchasedProduct(phone, productId);

      // Xử lý file upload
      let imageUrls = [];
      let videoUrl = '';
      if (req.files.images) {
        imageUrls = req.files.images.map(file => `/uploads/${file.filename}`);
      }
      if (req.files.video && req.files.video[0]) {
        videoUrl = `/uploads/${req.files.video[0].filename}`;
      }

      let status = 'pending';
      if (Number(rating) >= 4) status = 'approved';

      const review = await Review.create({
        productId, name, phone, email, title, content, rating,
        imageUrls, videoUrl, isPurchased, status,
        replies: [] // Khởi tạo mảng replies rỗng
      });

      res.json({ message: 'Gửi đánh giá thành công!', review });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// API trả lời bình luận cho review (bất kỳ ai cũng trả lời được)
router.post('/reply/:id', async (req, res) => {
  const { id } = req.params;
  const { name, content } = req.body;
  if (!name || !content) {
    return res.status(400).json({ message: 'Tên và nội dung trả lời là bắt buộc!' });
  }
  // Thêm trả lời vào mảng replies
  const result = await Review.findByIdAndUpdate(
    id,
    { $push: { replies: { name, content, createdAt: new Date() } } },
    { new: true }
  );
  if (!result) return res.status(404).json({ message: 'Không tìm thấy review!' });
  res.json({ message: 'Đã trả lời bình luận!', review: result });
});

// API lấy review đã duyệt theo sản phẩm, phân trang, filter/sort theo số sao
router.get('/product/:productId', async (req, res) => {
  const { productId } = req.params;
  const { page = 1, limit = 5, rating, sort = '-createdAt' } = req.query;

  const query = { productId, status: 'approved' };
  if (rating) query.rating = Number(rating);

  const reviews = await Review.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(Number(limit));
  res.json(reviews);
});

// API duyệt review (admin)
router.post('/approve/:id', async (req, res) => {
  const { id } = req.params;
  await Review.findByIdAndUpdate(id, { status: 'approved' });
  res.json({ message: 'Đã duyệt review!' });
});

module.exports = router;
