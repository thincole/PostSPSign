const express = require('express');
const router = express.Router();
const updaterService = require('../services/updater.service');

// Check for available updates on GitHub
router.get('/check', async (req, res) => {
  try {
    const result = await updaterService.checkUpdate();
    res.json(result);
  } catch (err) {
    console.error('Update check endpoint error:', err);
    res.status(500).json({
      hasUpdate: false,
      error: err.message || 'Lỗi khi kiểm tra bản cập nhật trên GitHub'
    });
  }
});

// Perform full online update from GitHub
router.post('/apply', async (req, res) => {
  try {
    const result = await updaterService.performUpdate();
    res.json(result);
  } catch (err) {
    console.error('Update apply endpoint error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Xảy ra lỗi trong quá trình tải và cài đặt bản cập nhật'
    });
  }
});

module.exports = router;
