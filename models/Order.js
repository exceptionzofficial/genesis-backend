const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  productName: String,
  colorName: String,
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
});

const OrderSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  address: String,
  items: [OrderItemSchema],
  totalAmount: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  advancePaid: { type: Number, default: 0 },
  remainingBalance: { type: Number, default: 0 },
  paymentStatus: { 
    type: String, 
    enum: ["pending", "partial", "completed"], 
    default: "pending" 
  },
  orderStatus: { 
    type: String, 
    enum: ["pending", "confirmed", "delivered", "cancelled"], 
    default: "pending" 
  },
  deliveryDate: Date,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", OrderSchema);
