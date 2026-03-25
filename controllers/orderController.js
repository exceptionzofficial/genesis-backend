const Order = require("../models/Order");
const Product = require("../models/Product");
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
    const { customerName, phone, address, items, totalAmount, discount, advancePaid, remainingBalance, deliveryDate } = req.body;
    
    const order = new Order({
      customerName, phone, address, items, totalAmount, discount, advancePaid, remainingBalance, deliveryDate
    });
    
    await order.save();

    // Deduct Stock
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (product) {
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

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice_${order._id}.pdf`);
    
    await generateInvoice(order, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Dashboard Stats
exports.getDashboardStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const products = await Product.countDocuments();
    const lowStockCount = await Product.countDocuments({ $expr: { $lte: ["$stock", "$alertThreshold"] } });
    
    // Total Revenue (Total Advance Paid)
    const revenueData = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$advancePaid" } } }
    ]);
    const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

    // Recent Orders
    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(10);

    // Pending Payments
    const pendingPaymentData = await Order.aggregate([
      { $match: { paymentStatus: { $ne: "completed" } } },
      { $group: { _id: null, total: { $sum: "$remainingBalance" } } }
    ]);
    const pendingPaymentTotal = pendingPaymentData.length > 0 ? pendingPaymentData[0].total : 0;

    res.json({
      totalOrders,
      products,
      lowStockCount,
      totalRevenue,
      recentOrders,
      pendingPaymentTotal
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
