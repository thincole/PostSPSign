const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const VideoTask = require("../models/video.model");
const User = require("../models/user.model");
const Thread = require("../models/thread.model");
const importService = require("../services/import.service");
const fs = require("fs");

const upload = multer({ dest: "uploads/" });

// POST /scan-folder
router.post("/scan-folder", (req, res) => {
  const folderPath = (req.body.folderPath || "").trim();
  if (!folderPath) {
    return res.json({ success: false, error: "Chưa nhập folder" });
  }
  try {
    const files = fs.readdirSync(folderPath);
    const videos = files.filter(f => /\.(mp4|mov|avi|mkv|webm|flv|m4v)$/i.test(f));
    res.json({
      success: true,
      total: files.length,
      videoCount: videos.length,
      videos: videos.slice(0, 50),
    });
  } catch (err) {
    res.json({ success: false, error: "Folder không tồn tại hoặc không đọc được" });
  }
});

// GET /api/config/country-import
router.get("/config/country-import", (req, res) => {
  try {
    const config = importService.getImportConfigs();
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/config/country-import
router.post("/config/country-import", (req, res) => {
  try {
    importService.saveImportConfig(req.body);
    res.json({ success: true, message: "Lưu cấu hình thành công" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /import-excel
router.post("/import-excel", upload.single("excelFile"), async (req, res) => {
  const driveLink = (req.body.driveLink || "").trim();
  const excelPath = req.file ? req.file.path : null;

  const videoFolder = (req.body.videoFolder || "").trim();
  const delayMin = req.body.delayMin || "186";
  const delayMax = req.body.delayMax || "245";
  const country = req.body.country || "vn";
  const autoStart = req.body.autoStart !== "false";
  const maxVideosPerAccount = req.body.maxVideosPerAccount || "0";
  const sheetName = req.body.sheetName || null;

  try {
    const result = await importService.executeImport({
      videoFolder,
      driveLink,
      delayMin,
      delayMax,
      country,
      autoStart,
      maxVideosPerAccount,
      excelPath,
      sheetName
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /task-stats
router.get("/task-stats", async (req, res) => {
  try {
    const stats = await VideoTask.getStats();
    const byUser = await VideoTask.getStatsByUser();
    res.json({
      success: true,
      stats,
      byUser
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tasks
router.get("/tasks", async (req, res) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId) : null;
    if (userId) {
      const dbConn = require("../database/connection").getConnection();
      const userTasks = await new Promise((resolve, reject) => {
        dbConn.all(
          "SELECT * FROM video_tasks WHERE user_id = ? ORDER BY id",
          [userId],
          (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
          }
        );
      });
      return res.json(userTasks);
    }
    const tasks = await VideoTask.getAll(200);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /tasks
router.delete("/tasks", async (req, res) => {
  try {
    await VideoTask.deleteAll();
    res.json({ success: true, message: "Đã xoá tất cả tasks" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /tasks/retry
router.post("/tasks/retry", async (req, res) => {
  try {
    const count = await VideoTask.retryAllFailed();
    res.json({
      success: true,
      message: "Đã retry " + count + " tasks",
      count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;