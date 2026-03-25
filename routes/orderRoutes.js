const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

router.get("/", orderController.getOrders);
router.get("/stats", orderController.getDashboardStats);
router.get("/:id/invoice", orderController.downloadInvoice);
router.get("/:id", orderController.getOrder);
router.post("/", orderController.createOrder);
router.put("/:id", orderController.updateOrder);

module.exports = router;
