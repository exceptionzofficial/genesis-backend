const Settings = require("../models/Settings");

// Get a setting by key
exports.getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    let setting = await Settings.findOne({ key });
    if (!setting) {
      // Return a default empty structure if not found
      return res.json({ key, value: null });
    }
    res.json(setting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update or create a setting
exports.updateSetting = async (req, res) => {
  try {
    const { key, value } = req.body;
    let setting = await Settings.findOneAndUpdate(
      { key },
      { value, updatedAt: Date.now() },
      { new: true, upsert: true }
    );
    res.json(setting);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
