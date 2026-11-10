const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const User = require('../models/user.model');
const Thread = require('../models/thread.model');
const upload = multer({ dest: 'uploads/' });

// POST /import-txt
router.post('/import-txt', upload.single('userFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Không có tệp được tải lên' });
  }

  try {
    const rawData = await fs.readFile(req.file.path, 'utf-8');
    const lines = rawData.trim().split('\n');

    const parsedData = [];
    const defaultCountry = req.body.country ? req.body.country.trim().toLowerCase() : 'vn';
    const seenUsers = new Set();

    for (const line of lines) {
      const parts = line.trim().split('|');
      if (parts.length < 2) continue;
      const username = parts[0].trim();
      const cookie = parts[1].trim();
      const proxy = parts[2] ? parts[2].trim() : '';
      const country = parts[3] ? parts[3].trim().toLowerCase() : defaultCountry;

      if (!username || !cookie) continue;
      if (!seenUsers.has(username)) {
        seenUsers.add(username);
        parsedData.push({ username, cookie, proxy, country });
      }
    }

    const results = {
      total: parsedData.length,
      successful: 0,
      skipped: 0
    };

    for (const item of parsedData) {
      try {
        const existing = await User.findByUsername(item.username);
        if (existing) {
          await Promise.all([
            User.update(existing.id, item.username, item.cookie),
            User.updateProxy(existing.id, item.proxy),
            User.updateCountry(existing.id, item.country),
            Thread.clearError(existing.id)
          ]);
          results.skipped++;
        } else {
          await User.create(item.username, item.cookie, item.proxy, item.country);
          results.successful++;
        }
      } catch (err) {
        console.error('Error importing user ' + item.username + ':', err);
      }
    }

    await fs.unlink(req.file.path);
    res.json({
      success: true,
      message: 'Nhập người dùng thành công',
      results
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({
      success: false,
      message: 'Error importing users',
      error: err.message
    });
  }
});

// POST /
router.post('', async (req, res) => {
  try {
    const { username, cookie, proxy, country } = req.body;
    const existing = await User.findByUsername(username);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Tên người dùng đã tồn tại' });
    }
    await User.create(username, cookie, proxy, country || 'vn');
    res.status(201).json({ success: true, message: 'Tạo người dùng thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, cookie, proxy, country } = req.body;

    if (proxy !== undefined && !cookie && !username && country === undefined) {
      await User.updateProxy(id, proxy);
      return res.json({ success: true, message: 'Cập nhật proxy thành công' });
    }

    if (country !== undefined && !cookie && !username && proxy === undefined) {
      await User.updateCountry(id, country);
      return res.json({ success: true, message: 'Cập nhật quốc gia thành công' });
    }

    if (cookie && !username && proxy === undefined && country === undefined) {
      await Promise.all([
        User.updateCookie(id, cookie),
        Thread.clearError(id)
      ]);
      return res.json({ success: true, message: 'Cập nhật cookie thành công' });
    }

    if (username && !cookie && proxy === undefined && country === undefined) {
      const existing = await User.findByUsername(username);
      if (existing && existing.id !== Number(id)) {
        return res.status(409).json({ success: false, message: 'Tên người dùng đã tồn tại' });
      }
      await User.updateUsername(id, username);
      return res.json({ success: true, message: 'Cập nhật username thành công' });
    }

    const existing = await User.findByUsername(username);
    if (existing && existing.id !== Number(id)) {
      return res.status(409).json({ success: false, message: 'Tên người dùng đã tồn tại' });
    }

    await User.update(id, username, cookie);
    if (proxy !== undefined) await User.updateProxy(id, proxy);
    if (country !== undefined) await User.updateCountry(id, country);
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id/country
router.put('/:id/country', async (req, res) => {
  try {
    const { id } = req.params;
    const { country } = req.body;
    await User.updateCountry(id, country || 'vn');
    res.json({ success: true, country: country || 'vn' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id/active
router.put('/:id/active', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const activeVal = is_active ? 1 : 0;
    await User.updateIsActive(id, activeVal);
    res.json({
      success: true,
      is_active: activeVal,
      message: activeVal ? 'Đã kích hoạt tài khoản' : 'Đã tắt kích hoạt tài khoản'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /export-json
router.get('/export-json', async (req, res) => {
  try {
    const users = await User.getAll();
    const cleanUsers = users.map(u => ({
      username: u.username,
      cookie: u.cookie,
      proxy: u.proxy || '',
      country: u.country || 'vn'
    }));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="users_' + Date.now() + '.json"');
    res.send(JSON.stringify(cleanUsers, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /import-json
router.post('/import-json', upload.single('userJsonFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Không có tệp được tải lên' });
  }

  try {
    const rawData = await fs.readFile(req.file.path, 'utf-8');
    const items = JSON.parse(rawData);
    if (!Array.isArray(items)) {
      throw new Error('File JSON phải là mảng [{"username", "cookie"}]');
    }

    let added = 0;
    let updated = 0;
    const defaultCountry = req.body.country ? req.body.country.trim().toLowerCase() : 'vn';

    for (const item of items) {
      if (!item.username || !item.cookie) continue;
      const existing = await User.findByUsername(item.username);
      if (existing) {
        await Promise.all([
          User.update(existing.id, item.username, item.cookie),
          User.updateProxy(existing.id, item.proxy || ''),
          User.updateCountry(existing.id, item.country || defaultCountry),
          Thread.clearError(existing.id)
        ]);
        updated++;
      } else {
        await User.create(item.username, item.cookie, item.proxy || '', item.country || defaultCountry);
        added++;
      }
    }

    await fs.unlink(req.file.path);
    res.json({
      success: true,
      message: 'Nhập thành công ' + added + ' tài khoản mới, cập nhật ' + updated + ' tài khoản.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /delete-batch
router.post('/delete-batch', async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có người dùng nào được chọn' });
    }
    await User.deleteBatch(userIds);
    res.json({ success: true, message: `Đã xóa thành công ${userIds.length} người dùng` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /delete-all
router.delete('/delete-all', async (req, res) => {
  try {
    await User.deleteAll();
    res.json({ success: true, message: 'Đã xóa tất cả người dùng thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await User.delete(id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /assign-random-proxy
router.post('/assign-random-proxy', async (req, res) => {
  const { userIds } = req.body;
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ success: false, error: 'Không có người dùng nào được chọn' });
  }
  const db = require('../database/connection').getConnection();
  db.all('SELECT proxy FROM proxies', [], async (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Lỗi truy vấn cơ sở dữ liệu' });
    }
    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có proxy live nào trong database. Vui lòng check proxy trước.' });
    }
    const aliveProxies = rows.map(r => r.proxy);
    try {
      const promises = userIds.map(userId => {
        const randomProxy = aliveProxies[Math.floor(Math.random() * aliveProxies.length)];
        return User.updateProxy(userId, randomProxy);
      });
      await Promise.all(promises);
      res.json({ success: true, message: `Đã chèn proxy ngẫu nhiên cho ${userIds.length} người dùng.` });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, error: 'Lỗi khi cập nhật proxy: ' + e.message });
    }
  });
});

// POST /login-shopee
router.post('/login-shopee', async (req, res) => {
  const puppeteer = require('puppeteer-core');
  const fs = require('fs');
  const path = require('path');

  function getChromePath() {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env.PROGRAMFILES || '', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google\\Chrome\\Application\\chrome.exe')
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'Thiếu userId' });
  }

  const db = require('../database/connection').getConnection();
  db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err || !user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });
    }

    const chromePath = getChromePath();
    if (!chromePath) {
      return res.status(400).json({ success: false, error: 'Không tìm thấy Google Chrome trên máy tính của bạn.' });
    }

    let browser;
    let closedExplicitly = false;
    let cookieFound = false;

    const { getCountry } = require('../utils/country');
    const countryInfo = getCountry(user.country || 'vn');
    const targetBaseDomain = `shopee.${countryInfo.tld}`;

    try {
      const args = [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled'
      ];

      if (user.proxy) {
        const parts = user.proxy.split(':');
        if (parts.length >= 2) {
          args.push(`--proxy-server=http://${parts[0]}:${parts[1]}`);
        }
      }

      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        defaultViewport: null,
        args,
        ignoreDefaultArgs: ['--enable-automation']
      });

      const page = (await browser.pages())[0] || await browser.newPage();

      if (user.proxy) {
        const parts = user.proxy.split(':');
        if (parts.length >= 4) {
          await page.authenticate({
            username: parts[2],
            password: parts[3]
          });
        }
      }

      browser.on('disconnected', () => {
        closedExplicitly = true;
      });

      await page.goto(`https://${targetBaseDomain}/buyer/login?next=https%3A%2F%2F${targetBaseDomain}%2F`, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      const pollInterval = setInterval(async () => {
        if (closedExplicitly || cookieFound) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const cookies = await page.cookies(`https://${targetBaseDomain}`, `https://banhang.${targetBaseDomain}`);
          const spcEcCookie = cookies.find(c => c.name === 'SPC_EC');

          if (spcEcCookie) {
            cookieFound = true;
            clearInterval(pollInterval);

            const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

            db.run('UPDATE users SET cookie = ? WHERE id = ?', [cookieStr, userId], async (updateErr) => {
              if (updateErr) {
                console.error('Lỗi cập nhật cookie:', updateErr);
                try { res.status(500).json({ success: false, error: 'Lỗi cập nhật cookie vào DB' }); } catch (e) { }
              } else {
                const ThreadModel = require('../models/thread.model');
                try {
                  await ThreadModel.clearError(userId);
                } catch (e) { }

                try {
                  res.json({
                    success: true,
                    message: 'Đăng nhập thành công! Đã tự động cập nhật cookie mới.',
                    cookie: cookieStr
                  });
                } catch (e) { }
              }

              setTimeout(async () => {
                try { await browser.close(); } catch (e) { }
              }, 1000);
            });
          }
        } catch (pollErr) {
          console.error('Lỗi khi quét cookie:', pollErr);
        }
      }, 2000);

      setTimeout(async () => {
        if (!cookieFound && !closedExplicitly) {
          clearInterval(pollInterval);
          closedExplicitly = true;
          try { res.status(408).json({ success: false, error: 'Quá thời gian chờ đăng nhập (5 phút).' }); } catch (e) { }
          try { await browser.close(); } catch (e) { }
        }
      }, 300000);

    } catch (launchErr) {
      console.error('Lỗi khởi động Chrome:', launchErr);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Không thể mở trình duyệt Chrome: ' + launchErr.message });
      }
      try { if (browser) await browser.close(); } catch (e) { }
    }
  });
});

// POST /:id/recover-cookie (Lớp 1 + Lớp 3 / Interactive cho từng tài khoản trong Quản Lý Người Dùng)
router.post('/:id/recover-cookie', async (req, res) => {
  try {
    const cookieRecoveryService = require('../services/cookie-recovery.service');
    const result = await cookieRecoveryService.recoverUserCookie(req.params.id, {
      forceGemLogin: Boolean(req.body?.forceGemLogin),
      interactive: Boolean(req.body?.interactive),
      autoStart: req.body?.autoStart !== false
    });
    res.json(result);
  } catch (err) {
    console.error('Recover user cookie error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /recover-cookies (Lớp 1 + Lớp 3 hàng loạt trong Quản Lý Người Dùng)
router.post('/recover-cookies', async (req, res) => {
  try {
    const cookieRecoveryService = require('../services/cookie-recovery.service');
    const result = await cookieRecoveryService.recoverBatchUsersCookies({
      userIds: req.body?.userIds || [],
      forceGemLogin: Boolean(req.body?.forceGemLogin)
    });
    res.json(result);
  } catch (err) {
    console.error('Recover batch users cookies error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;