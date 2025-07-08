const express = require('express');
const multer = require('multer');
const path = require('path');
const Review = require('../models/Review'); // Đảm bảo đường dẫn và tên file model Review là chính xác
const { hasPurchasedProduct } = require('../utils/haravan'); // Đảm bảo đường dẫn và module haravan là chính xác
const axios = require('axios'); // Đảm bảo bạn đã cài đặt axios (npm install axios)

const router = express.Router(); // Khởi tạo Express Router

// === Cấu hình lưu file upload local ===
// Đảm bảo thư mục 'uploads/' tồn tại trong thư mục gốc của dự án của bạn
// và có quyền ghi (writable) cho server.
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 'uploads/' là thư mục nơi các file sẽ được lưu
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Tạo tên file duy nhất để tránh trùng lặp
        const ext = path.extname(file.originalname); // Lấy phần mở rộng của file (ví dụ: .jpg, .mp4)
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
    }
});
const upload = multer({ storage }); // Khởi tạo Multer với cấu hình storage

// === API gửi review mới, cho upload tối đa 5 ảnh, 1 video ===
router.post(
    '/create',
    // Sử dụng upload.fields để xử lý nhiều loại file (images và video)
    upload.fields([
        { name: 'images', maxCount: 5 }, // Tối đa 5 ảnh
        { name: 'video', maxCount: 1 }   // Tối đa 1 video
    ]),
    async (req, res) => {
        try {
            // Lấy dữ liệu từ body của request
            const { productId, name, phone, email, title, content, rating } = req.body;

            // Kiểm tra các trường bắt buộc
            if (!name || !phone || !content) {
                return res.status(400).json({ message: 'Họ tên, SĐT và nội dung là bắt buộc!' });
            }

            // === Logic chống spam (10s) ===
            // Tìm bài đánh giá gần nhất của người dùng cho sản phẩm này
            const lastReview = await Review.findOne({ phone, productId }).sort({ createdAt: -1 });
            // Nếu có bài đánh giá gần đây và thời gian chưa đủ 10 giây
            if (lastReview && (Date.now() - lastReview.createdAt.getTime() < 10000)) {
                return res.status(429).json({ message: 'Vui lòng đợi 10s trước khi gửi tiếp!' });
            }

            // === Kiểm tra đã mua hàng (có thể bỏ nếu không cần) ===
            // Hàm hasPurchasedProduct phải được định nghĩa và hoạt động đúng
            const isPurchased = await hasPurchasedProduct(phone, productId);

            // === Xử lý file upload ===
            let imageUrls = [];
            let videoUrl = '';
            // Lấy đường dẫn của các ảnh đã upload
            if (req.files && req.files.images) {
                imageUrls = req.files.images.map(file => `/uploads/${file.filename}`);
            }
            // Lấy đường dẫn của video đã upload
            if (req.files && req.files.video && req.files.video[0]) {
                videoUrl = `/uploads/${req.files.video[0].filename}`;
            }

            // === Xác định trạng thái review ban đầu ===
            let status = 'pending'; // Mặc định là chờ duyệt
            if (Number(rating) >= 4) status = 'approved'; // Tự động duyệt nếu rating >= 4

            // === Lưu bài đánh giá vào database ===
            const review = await Review.create({
                productId, name, phone, email, title, content, rating,
                imageUrls, videoUrl, isPurchased, status,
                replies: [] // Khởi tạo mảng replies rỗng
            });
        // === Trả về thông báo thành công cho người dùng ===
        res.status(201).json({ message: 'Gửi đánh giá thành công!', review });

    } catch (error) {
        // Xử lý lỗi chung trong quá trình tạo review
        console.error('[Review Backend] Lỗi khi tạo review:', error.message);
        res.status(500).json({ message: error.message });
    }
}
);
// === API lấy review đã duyệt theo sản phẩm, phân trang, filter/sort theo số sao ===
router.get('/product/:productId', async (req, res) => {
    const { productId } = req.params; // Lấy productId từ URL
    // Lấy các tham số phân trang, lọc và sắp xếp từ query string
    const { page = 1, limit = 5, rating, sort = '-createdAt' } = req.query;

    // Xây dựng query object
    const query = { productId, status: 'approved' }; // Chỉ lấy review đã duyệt
    if (rating) query.rating = Number(rating); // Lọc theo số sao nếu có

    try {
        // Thực hiện truy vấn MongoDB
        const reviews = await Review.find(query)
            .sort(sort) // Sắp xếp
            .skip((page - 1) * limit) // Bỏ qua số lượng review của các trang trước
            .limit(Number(limit)); // Giới hạn số lượng review trên mỗi trang

        res.json(reviews);
    } catch (error) {
        console.error('[Review Backend] Lỗi khi lấy review theo sản phẩm:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// === API duyệt review (admin) ===
router.post('/approve/:id', async (req, res) => {
    const { id } = req.params; // Lấy ID của review cần duyệt
    try {
        await Review.findByIdAndUpdate(id, { status: 'approved' }); // Cập nhật trạng thái thành 'approved'
        res.json({ message: 'Đã duyệt review!' });
    } catch (error) {
        console.error('[Review Backend] Lỗi khi duyệt review:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// === API tổng hợp rating cho 1 sản phẩm ===
router.get('/summary/:productId', async (req, res) => {
    const { productId } = req.params; // Lấy productId từ URL
    try {
        // Lấy tất cả review đã duyệt cho sản phẩm này
        const reviews = await Review.find({ productId, status: 'approved' });
        const total = reviews.length; // Tổng số đánh giá

        let sum = 0;
        // Đếm số lượng review cho từng mức sao
        const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(r => {
            const star = Math.round(Number(r.rating) || 0); // Làm tròn số sao
            if (star >= 1 && star <= 5) {
                counts[star]++;
                sum += star;
            }
        });

        // Tính điểm trung bình
        const avgRating = total ? (sum / total) : 0;

        res.json({
            productId,
            avgRating: Number(avgRating.toFixed(1)), // Làm tròn 1 chữ số thập phân
            total,
            count_5: counts[5],
            count_4: counts[4],
            count_3: counts[3],
            count_2: counts[2],
            count_1: counts[1]
        });
    } catch (error) {
        console.error('[Review Backend] Lỗi khi tổng hợp rating:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// === API để Backend Điểm thưởng gọi lấy số lượng review thực tế của người dùng ===
router.get('/count', async (req, res) => {
    const { phone } = req.query; // Lấy số điện thoại từ query string
    if (!phone) {
        return res.status(400).json({ message: 'Thiếu số điện thoại!' });
    }

    try {
        const now = new Date();
        // Tính toán khoảng thời gian cho ngày hiện tại
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        // Tính toán khoảng thời gian cho tháng hiện tại
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // Đếm số review đã duyệt trong ngày hiện tại của người dùng
        const reviewsToday = await Review.countDocuments({
            phone: phone,
            createdAt: { $gte: startOfDay, $lt: endOfDay },
            status: 'approved' // Chỉ đếm review đã được duyệt
        });

        // Đếm số review đã duyệt trong tháng hiện tại của người dùng
        const reviewsMonthly = await Review.countDocuments({
            phone: phone,
            createdAt: { $gte: startOfMonth, $lt: endOfMonth },
            status: 'approved' // Chỉ đếm review đã được duyệt
        });

        res.json({
            today: reviewsToday,
            monthly: reviewsMonthly
        });
    } catch (error) {
        console.error('[Review Backend] Lỗi khi lấy số lượng review:', error.message);
        res.status(500).json({ message: 'Lỗi server khi lấy số lượng review.' });
    }
});

module.exports = router; // Export router để được sử dụng trong file app.js chính
