const axios = require('axios');

const ACCESS_TOKEN = process.env.HARAVAN_ACCESS_TOKEN || '8D69E2B91FDF0D073CAC0126CCA36B924276EB0DFF55C7F76097CFD8283920BE';
const SHOP_DOMAIN = process.env.HARAVAN_SHOP_DOMAIN || 'neko-chin-shop-5.myharavan.com';

/**
 * Kiểm tra một SĐT đã có đơn mua sản phẩm này chưa (trong shop),
 * với điều kiện đơn hàng đã thanh toán và đã giao hàng.
 *
 * @param {string} customerPhone - Số điện thoại của khách hàng.
 * @param {string | number} productIdToFind - ID sản phẩm (có thể là ID số hoặc handle) cần tìm.
 * @returns {Promise<boolean>} True nếu tìm thấy, ngược lại False.
 */
async function hasPurchasedProduct(customerPhone, productIdToFind) {
    if (!customerPhone || !productIdToFind) {
        console.warn('Thiếu số điện thoại hoặc Product ID để kiểm tra mua hàng.');
        return false;
    }

    try {
        // --- BƯỚC 1: TÌM CUSTOMER ID TỪ SỐ ĐIỆN THOẠI ---
        const customerUrl = `https://${SHOP_DOMAIN}/admin/customers.json`;
        const customerResp = await axios.get(customerUrl, {
            params: { phone: customerPhone }, // Haravan cho phép lọc khách hàng theo phone
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
        });

        const customers = customerResp.data.customers;
        if (!customers || customers.length === 0) {
            console.log(`[Haravan Util] Không tìm thấy khách hàng với SĐT: ${customerPhone}`);
            return false;
        }

        // Lấy customer_id của khách hàng đầu tiên tìm được
        const customerId = customers[0].id;

        // --- BƯỚC 2: LẤY TẤT CẢ ĐƠN HÀNG CỦA CUSTOMER ID ĐÓ ---
        // Sử dụng status=any để lấy tất cả đơn hàng, sau đó lọc thủ công
        const ordersUrl = `https://${SHOP_DOMAIN}/admin/customers/${customerId}/orders.json`;
        const ordersResp = await axios.get(ordersUrl, {
            params: { status: 'any' }, // Lấy tất cả trạng thái để kiểm tra thủ công
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
        });

        const orders = ordersResp.data.orders || [];
        if (orders.length === 0) {
            console.log(`[Haravan Util] Không tìm thấy đơn hàng nào cho khách hàng ID: ${customerId}`);
            return false;
        }

        // --- BƯỚC 3: DUYỆT TỪNG ĐƠN HÀNG VÀ KIỂM TRA SẢN PHẨM & TRẠNG THÁI ---
        for (const order of orders) {
            // Kiểm tra trạng thái thanh toán và giao hàng
            const isPaid = order.financial_status === 'paid';
            const isFulfilled = ['fulfilled', 'delivered'].includes(order.fulfillment_status); // 'delivered' cũng là trạng thái giao hàng

            if (isPaid && isFulfilled) {
                // Duyệt qua các sản phẩm trong đơn hàng
                if (order.line_items) {
                    for (const item of order.line_items) {
                        // So sánh productIdToFind với cả product_id (số) và product_handle (chuỗi)
                        // Đảm bảo chuyển đổi productIdToFind sang dạng String để so sánh với cả hai trường Haravan.
                        if (String(item.product_id) === String(productIdToFind) || String(item.product_handle) === String(productIdToFind)) {
                            console.log(`[Haravan Util] Khách hàng ${customerPhone} ĐÃ mua SP ${productIdToFind} (Đơn #${order.id})`);
                            return true; // Đã tìm thấy đơn hàng thỏa mãn điều kiện
                        }
                    }
                }
            }
        }

        console.log(`[Haravan Util] Khách hàng ${customerPhone} CHƯA mua SP ${productIdToFind} với điều kiện đã thanh toán/giao hàng.`);
        return false;

    } catch (err) {
    console.error(`[Haravan Util] Lỗi kiểm tra mua hàng cho SĐT ${customerPhone}, SP ${productIdToFind} (chi tiết):`);
    // In ra toàn bộ đối tượng lỗi để không bỏ sót thông tin
    console.error(err);
    // Nếu là lỗi Axios, in thêm phản hồi từ server nếu có
    if (err.response) {
        console.error('Haravan API Response Error Data:', err.response.data);
        console.error('Haravan API Response Status:', err.response.status);
        console.error('Haravan API Response Headers:', err.response.headers);
    } else if (err.request) {
        // Request được tạo nhưng không nhận được phản hồi (ví dụ: mạng)
        console.error('Haravan API Request Error (no response):', err.request);
    } else {
        // Lỗi khi thiết lập request
        console.error('Haravan API Config/Setup Error:', err.message);
    }
    return false;
}
}

module.exports = { hasPurchasedProduct };
