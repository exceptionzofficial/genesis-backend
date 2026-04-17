const Order = require("../models/Order");
const Product = require("../models/Product");
const Settings = require("../models/Settings");
const { generateInvoice } = require("../utils/invoiceGenerator");

// Get all orders
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get single order
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create order
exports.createOrder = async (req, res) => {
  try {
    const { customerName, phone, address, items, totalAmount, discount, gstPercentage, gstAmount, advancePaid, remainingBalance, deliveryDate } = req.body;
    
    const order = new Order({
      customerName, phone, address, items, totalAmount, discount, gstPercentage, gstAmount, advancePaid, remainingBalance, deliveryDate
    });
    
    await order.save();

    // Deduct Stock (Only if enabled for that product)
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (product && product.stockEnabled) {
        product.stock = Math.max(0, product.stock - item.quantity);
        await product.save();
      }
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update order
exports.updateOrder = async (req, res) => {
  try {
    const { orderStatus, paymentStatus, advancePaid, remainingBalance, discount } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (advancePaid !== undefined) order.advancePaid = advancePaid;
    if (remainingBalance !== undefined) order.remainingBalance = remainingBalance;
    if (discount !== undefined) order.discount = discount;

    await order.save();
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Download Invoice (Direct Stream)
exports.downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Fetch Store Settings
    const storeInfoSetting = await Settings.findOne({ key: 'store_info' });
    const reviewUrlSetting = await Settings.findOne({ key: 'googleReviewUrl' });
    
    const settings = {
      store_info: storeInfoSetting?.value,
      googleReviewUrl: reviewUrlSetting?.value
    };

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice_${order._id}.pdf`);
    
    await generateInvoice(order, res, settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Dashboard Stats
exports.getDashboardStats = async (req, res) => {
  try {
    console.log("Fetching Dashboard Stats...");
    
    // 1. Basic counts
    const totalOrders = await Order.countDocuments().catch(e => { console.error("TotalOrders Err:", e); return 0; });
    const products = await Product.countDocuments().catch(e => { console.error("Products Err:", e); return 0; });
    
    // 2. Low Stock Count
    let lowStockCount = 0;
    try {
      lowStockCount = await Product.countDocuments({ 
        stockEnabled: true, 
        $expr: { $lte: ["$stock", "$alertThreshold"] } 
      });
    } catch (e) {
      console.error("LowStock Aggregation Err:", e);
      lowStockCount = await Product.countDocuments({ stockEnabled: true, stock: { $lt: 5 } });
    }
    
    // 3. Total Revenue
    let totalRevenue = 0;
    try {
      const revenueData = await Order.aggregate([
        { $group: { _id: null, total: { $sum: { $ifNull: ["$advancePaid", 0] } } } }
      ]);
      totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;
    } catch (e) {
      console.error("Revenue Aggregation Err:", e);
    }

    // 4. Recent Orders
    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(10).catch(e => []);

    // 5. Pending Payments
    let pendingPaymentTotal = 0;
    try {
      const pendingPaymentData = await Order.aggregate([
        { $match: { paymentStatus: { $ne: "completed" } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$remainingBalance", 0] } } } }
      ]);
      pendingPaymentTotal = pendingPaymentData.length > 0 ? pendingPaymentData[0].total : 0;
    } catch (e) {
      console.error("Pending Payment Aggregation Err:", e);
    }

    res.json({
      totalOrders,
      products,
      lowStockCount,
      totalRevenue,
      recentOrders,
      pendingPaymentTotal
    });
  } catch (err) {
    console.error("CRITICAL DASHBOARD ERROR:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};

// Detailed Analytics
exports.getAnalytics = async (req, res) => {
  try {
    const { range = 'month' } = req.query; // 'day', 'week', 'month', 'year'
    
    let dateLimit = new Date();
    if (range === 'day') dateLimit.setHours(0, 0, 0, 0); 
    else if (range === 'week') dateLimit.setDate(dateLimit.getDate() - 7);
    else if (range === 'month') dateLimit.setMonth(dateLimit.getMonth() - 1);
    else if (range === 'year') dateLimit.setFullYear(dateLimit.getFullYear() - 1);

    // 1. Revenue Trends (Group by Date)
    const revenueTrends = await Order.aggregate([
      { $match: { createdAt: { $gte: dateLimit } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$advancePaid" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // 2. Category Distribution
    const categorySales = await Order.aggregate([
      { $match: { createdAt: { $gte: dateLimit } } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$product.category", "Uncategorized"] },
          total: { $sum: { $multiply: [{ $ifNull: ["$items.unitPrice", 0] }, { $ifNull: ["$items.quantity", 0] }] } },
          units: { $sum: { $ifNull: ["$items.quantity", 0] } }
        }
      }
    ]);

    // 3. Top Products
    const topProducts = await Order.aggregate([
      { $match: { createdAt: { $gte: dateLimit } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: { $ifNull: ["$items.productName", "Unknown Product"] },
          sales: { $sum: { $ifNull: ["$items.quantity", 0] } },
          revenue: { $sum: { $multiply: [{ $ifNull: ["$items.unitPrice", 0] }, { $ifNull: ["$items.quantity", 0] }] } }
        }
      },
      { $sort: { sales: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      revenueTrends,
      categorySales,
      topProducts
    });
  } catch (err) {
    console.error("ANALYTICS ERROR:", err);
    res.status(500).json({ message: "Analytics Calculation Failed", error: err.message });
  }
};
