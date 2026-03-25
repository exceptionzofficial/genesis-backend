const Product = require("../models/Product");
const { cloudinary } = require("../config/cloudinary");

// Get all products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get single product
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create product
exports.createProduct = async (req, res) => {
  try {
    const { name, category, description, basePrice, stock, alertThreshold, colors, images: bodyImages } = req.body;
    let images = req.files ? req.files.map(f => f.path) : [];
    let parsedColors = typeof colors === 'string' ? JSON.parse(colors) : (colors || []);

    // Map uploaded files back to colors
    if (req.files && req.files.length > 0) {
      const fileMap = {};
      req.files.forEach(f => {
        fileMap[f.originalname] = f.path;
      });

      parsedColors = parsedColors.map(c => {
        if (c.image && fileMap[c.image]) {
          return { ...c, image: fileMap[c.image] };
        }
        return c;
      });
    }
    
    // Add URLs from body if present
    if (bodyImages) {
      const urlList = Array.isArray(bodyImages) ? bodyImages : [bodyImages];
      images = [...images, ...urlList];
    }
    
    const product = new Product({
      name, category, description, basePrice, stock, alertThreshold, images, 
      colors: parsedColors 
    });
    
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const { name, category, description, basePrice, stock, alertThreshold, colors, images: bodyImages } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (name) product.name = name;
    if (category) product.category = category;
    if (description) product.description = description;
    if (basePrice) product.basePrice = basePrice;
    if (stock) product.stock = stock;
    if (alertThreshold) product.alertThreshold = alertThreshold;
    if (colors) {
      let parsedColors = typeof colors === 'string' ? JSON.parse(colors) : colors;
      
      // Map new uploaded files to updated colors
      if (req.files && req.files.length > 0) {
        const fileMap = {};
        req.files.forEach(f => {
          fileMap[f.originalname] = f.path;
        });

        parsedColors = parsedColors.map(c => {
          if (c.image && fileMap[c.image]) {
            return { ...c, image: fileMap[c.image] };
          }
          return c;
        });
      }
      product.colors = parsedColors;
    }
    
    // Update images - replace with current list from body + new files
    let updatedImages = [];
    if (bodyImages) {
      updatedImages = Array.isArray(bodyImages) ? bodyImages : [bodyImages];
    }
    
    if (req.files && req.files.length > 0) {
      updatedImages = [...updatedImages, ...req.files.map(f => f.path)];
    }
    
    if (updatedImages.length > 0 || (bodyImages && bodyImages.length === 0)) {
      product.images = updatedImages;
    }

    await product.save();
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Optional: Delete images from Cloudinary
    // product.images.forEach(async (url) => {
    //   const publicId = url.split('/').pop().split('.')[0];
    //   await cloudinary.uploader.destroy(publicId);
    // });

    await product.deleteOne();
    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
