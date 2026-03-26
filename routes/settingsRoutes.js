const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const { upload } = require("../config/cloudinary");

router.get("/:key", settingsController.getSetting);
router.post("/", settingsController.updateSetting);
router.post("/upload-logo", upload.single("logo"), settingsController.uploadLogo);

module.exports = router;
