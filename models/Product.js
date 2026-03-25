const mongoose = require("mongoose");

const ColorOptionSchema = new mongoose.Schema({
  name: String,
  hex: String,
  image: String,
});

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { 
    type: String, 
    enum: ["Sofa", "Bed", "Table", "Chair", "Mattress", "Recliner", "Cabinet", "Other"],
    required: true 
  },
  description: String,
  basePrice: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  alertThreshold: { type: Number, default: 5 },
  images: [String],
  colors: [ColorOptionSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Product", ProductSchema);
