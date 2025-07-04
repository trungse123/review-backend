// utils/haravan.js
const axios = require('axios');

const ACCESS_TOKEN = process.env.HARAVAN_ACCESS_TOKEN || 'DFE528F8C4CBA1B43727A729CD57187766E059E88AE96682DC2CF04AF4F61306';
// URL dưới đây chỉ là ví dụ, hãy thay bằng đúng endpoint của Haravan (nếu khác)
const SHOP_DOMAIN = process.env.HARAVAN_SHOP_DOMAIN || 'neko-chin-shop-5.myharavan.com'; // hoặc domain shop thật

/**
 * Kiểm tra một SĐT đã có đơn mua sản phẩm này chưa (trong shop)
 * Trả về true nếu tìm thấy đơn có sản phẩm và SĐT này.
 */
async function hasPurchasedProduct(phone, productId) {
  try {
    // 1. Lấy tất cả đơn hàng của user có số điện thoại này
    const url = `https://${SHOP_DOMAIN}/admin/orders.json?fields=id,customer,line_items,phone&phone=${phone}`;
    const resp = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    const orders = resp.data.orders || [];

    // 2. Duyệt từng đơn xem có sản phẩm này không
    for (const order of orders) {
      if (!order.line_items) continue;
      if (order.line_items.some(item => item.product_id === productId)) {
        return true;
      }
    }
    return false;
  } catch (err) {
    // Nếu lỗi, xử lý nhẹ nhàng
    console.error('Lỗi kiểm tra đơn hàng:', err.message);
    return false;
  }
}

module.exports = { hasPurchasedProduct };
