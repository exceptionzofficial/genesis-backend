const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { upload } = require("../config/cloudinary");

router.get("/", productController.getProducts);
router.get("/:id", productController.getProduct);
router.post("/", upload.array("images", 5), productController.createProduct);
router.put("/:id", upload.array("images", 5), productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

module.exports = router;
