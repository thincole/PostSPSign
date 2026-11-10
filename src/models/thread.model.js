const db = require("../database/connection").getConnection();

class Thread {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        videos_uploaded INTEGER DEFAULT 0,
        count_video_upload INTEGER DEFAULT 0,
        error TEXT,
        status TEXT DEFAULT 'inprogress',
        delaytime INTEGER DEFAULT 1,
        delaytime_count INTEGER DEFAULT 0,
        delay_min INTEGER DEFAULT 60,
        delay_max INTEGER DEFAULT 180,
        next_run_at INTEGER DEFAULT 0,
        proxy_host TEXT,
        proxy_port INTEGER,
        proxy_username TEXT,
        proxy_password TEXT,
        caption TEXT,
        upload_mode TEXT DEFAULT 'normal',
        auto_fill_products INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `;
    return new Promise((resolve, reject) => {
      db.run(query, (err) => {
        if (err) return reject(err);
        
        db.all("PRAGMA table_info(threads)", [], (infoErr, columns) => {
          if (infoErr) return resolve();
          
          const colNames = columns.map(c => c.name);
          
          if (!colNames.includes("delay_min")) {
            db.run("ALTER TABLE threads ADD COLUMN delay_min INTEGER DEFAULT 60");
          }
          if (!colNames.includes("delay_max")) {
            db.run("ALTER TABLE threads ADD COLUMN delay_max INTEGER DEFAULT 180");
          }
          if (!colNames.includes("next_run_at")) {
            db.run("ALTER TABLE threads ADD COLUMN next_run_at INTEGER DEFAULT 0");
          }
          if (!colNames.includes("upload_mode")) {
            db.run("ALTER TABLE threads ADD COLUMN upload_mode TEXT DEFAULT 'normal'");
          }
          if (!colNames.includes("auto_fill_products")) {
            db.run("ALTER TABLE threads ADD COLUMN auto_fill_products INTEGER DEFAULT 0");
          }
          if (!colNames.includes("country")) {
            db.run("ALTER TABLE threads ADD COLUMN country TEXT DEFAULT 'vn'");
          }
          db.run("CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);");
          db.run("CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);");
          db.run("CREATE INDEX IF NOT EXISTS idx_threads_status_nextrun ON threads(status, next_run_at);");
          db.run("CREATE INDEX IF NOT EXISTS idx_threads_proxy ON threads(proxy_host);");
          resolve();
        });
      });
    });
  }

  static async create(
    userId,
    delayMin,
    delayMax,
    proxyHost = null,
    proxyPort = null,
    proxyUsername = null,
    proxyPassword = null,
    countVideoUpload = 0,
    caption = null,
    uploadMode = "normal",
    autoFillProducts = 0,
    country = "vn"
  ) {
    const query = `
      INSERT INTO threads (
        user_id, delay_min, delay_max, delaytime_count, status, 
        proxy_host, proxy_port, proxy_username, proxy_password, 
        count_video_upload, caption, upload_mode, auto_fill_products, country
      ) VALUES (?, ?, ?, 0, 'stop', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    return new Promise((resolve, reject) => {
      db.run(
        query,
        [
          userId,
          delayMin,
          delayMax,
          proxyHost,
          proxyPort,
          proxyUsername,
          proxyPassword,
          countVideoUpload,
          caption,
          uploadMode,
          autoFillProducts ? 1 : 0,
          country || "vn"
        ],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });
  }

  static async updateCountry(id, country) {
    const query = "UPDATE threads SET country = ? WHERE id = ?";
    return new Promise((resolve, reject) => {
      db.run(query, [country || "vn", id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  static async getAll() {
    const query = `
      SELECT t.*, u.username, u.cookie
      FROM threads t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.error IS NOT NULL DESC, t.created_at DESC
    `;
    return new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async updateStatus(id, status) {
    const query = "UPDATE threads SET status = ? WHERE id = ?";
    return new Promise((resolve, reject) => {
      db.run(query, [status, id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  static async delete(id) {
    return new Promise((resolve, reject) => {
      db.get("SELECT user_id FROM threads WHERE id = ?", [id], (err, row) => {
        if (row && row.user_id) {
          db.run("DELETE FROM video_tasks WHERE user_id = ?", [row.user_id], () => {});
        }
        db.run("DELETE FROM threads WHERE id = ?", [id], (err2) => {
          if (err2) return reject(err2);
          resolve();
        });
      });
    });
  }

  static async incrementVideosUploaded(id) {
    const query = "UPDATE threads SET videos_uploaded = videos_uploaded + 1 WHERE id = ?";
    return new Promise((resolve, reject) => {
      db.run(query, [id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  static async getById(id) {
    const query = `
      SELECT t.*, u.username, u.cookie
      FROM threads t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
    `;
    return new Promise((resolve, reject) => {
      db.get(query, [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  static async updateError(threadId, errorText) {
    const query = "UPDATE threads SET error = ? WHERE id = ?";
    return new Promise((resolve, reject) => {
      db.run(query, [errorText, threadId], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  static async updateErrorByUserId(userId) {
    const query = "UPDATE threads SET error = NULL WHERE user_id = ?";
    return new Promise((resolve, reject) => {
      db.run(query, [userId], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  // Alias for updateErrorByUserId as requested by route logic (clearError)
  static async clearError(userId) {
    return this.updateErrorByUserId(userId);
  }

  static async updateVideosUploaded(id, count) {
    const query = "UPDATE threads SET videos_uploaded = ? WHERE id = ?";
    return new Promise((resolve, reject) => {
      db.run(query, [count, id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  static async updateProxy(id, host, port, username, password) {
    const query = "UPDATE threads SET proxy_host = ?, proxy_port = ?, proxy_username = ?, proxy_password = ? WHERE id = ?";
    return new Promise((resolve, reject) => {
      db.run(query, [host, port, username, password, id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  static async resetAllToInprogressThreads(staggerSec = 0.2) {
    return new Promise((resolve, reject) => {
      db.all("SELECT id FROM threads WHERE status != 'inprogress' ORDER BY id ASC", [], (err, rows) => {
        if (err) return reject(err);
        if (!rows || rows.length === 0) return resolve();
        const nowSec = Math.floor(Date.now() / 1000);
        db.serialize(() => {
          db.run("BEGIN TRANSACTION");
          const stmt = db.prepare(
            "UPDATE threads SET status = 'inprogress', error = NULL, videos_uploaded = 0, next_run_at = ? WHERE id = ?"
          );
          rows.forEach((r, idx) => {
            stmt.run([nowSec + Math.floor(idx * staggerSec), r.id]);
          });
          stmt.finalize();
          db.run("COMMIT", (commitErr) => {
            if (commitErr) return reject(commitErr);
            resolve();
          });
        });
      });
    });
  }

  static async updateDelay(id, delayMin, delayMax) {
    const query = "UPDATE threads SET delay_min = ?, delay_max = ? WHERE id = ?";
    return new Promise((resolve, reject) => {
      db.run(query, [delayMin, delayMax, id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  static async updateBatchDelay(delayMin, delayMax, threadIds = []) {
    let query = "UPDATE threads SET delay_min = ?, delay_max = ?";
    let params = [delayMin, delayMax];
    if (Array.isArray(threadIds) && threadIds.length > 0) {
      const placeholders = threadIds.map(() => '?').join(',');
      query += ` WHERE id IN (${placeholders})`;
      params.push(...threadIds);
    }
    return new Promise((resolve, reject) => {
      db.run(query, params, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  static async updateBatchStatus(status, threadIds = [], staggerSec = 0.2) {
    if (!Array.isArray(threadIds) || threadIds.length === 0) return;
    if (status === 'inprogress') {
      const nowSec = Math.floor(Date.now() / 1000);
      return new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run("BEGIN TRANSACTION");
          const stmt = db.prepare(
            "UPDATE threads SET status = 'inprogress', next_run_at = ?, error = NULL WHERE id = ?"
          );
          threadIds.forEach((id, idx) => {
            stmt.run([nowSec + Math.floor(idx * staggerSec), id]);
          });
          stmt.finalize();
          db.run("COMMIT", (commitErr) => {
            if (commitErr) return reject(commitErr);
            resolve();
          });
        });
      });
    }
    const placeholders = threadIds.map(() => '?').join(',');
    const query = `UPDATE threads SET status = 'stop' WHERE id IN (${placeholders})`;
    return new Promise((resolve, reject) => {
      db.run(query, threadIds, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  static async deleteBatch(threadIds = []) {
    if (!Array.isArray(threadIds) || threadIds.length === 0) return;
    const placeholders = threadIds.map(() => '?').join(',');
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(`DELETE FROM video_tasks WHERE user_id IN (SELECT user_id FROM threads WHERE id IN (${placeholders}))`, threadIds, (err1) => {
          if (err1) console.error('Error deleting video_tasks for threads:', err1);
        });
        db.run(`DELETE FROM threads WHERE id IN (${placeholders})`, threadIds, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  static async deleteCompleted() {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(`DELETE FROM video_tasks WHERE user_id IN (SELECT user_id FROM threads WHERE status = 'done' AND count_video_upload <= videos_uploaded)`, [], () => {});
        db.run(`DELETE FROM threads WHERE status = 'done' AND count_video_upload <= videos_uploaded`, [], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }
}

// Self-executing setup logic on startup
Thread.createTable()
  .then(() => {
    db.all("PRAGMA table_info(threads)", [], (err, columns) => {
      if (err) return;
      const colNames = columns.map(c => c.name);
      
      if (!colNames.includes("is_duet")) {
        db.run("ALTER TABLE threads ADD COLUMN is_duet INTEGER DEFAULT 0");
      }
      if (!colNames.includes("upload_mode")) {
        db.run("ALTER TABLE threads ADD COLUMN upload_mode TEXT DEFAULT 'normal'");
      }
      if (!colNames.includes("auto_fill_products")) {
        db.run("ALTER TABLE threads ADD COLUMN auto_fill_products INTEGER DEFAULT 0");
      }
      if (!colNames.includes("country")) {
        db.run("ALTER TABLE threads ADD COLUMN country TEXT DEFAULT 'vn'");
      }
    });
  })
  .catch(console.error);

module.exports = Thread;
