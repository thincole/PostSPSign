const db = require("../database/connection").getConnection();

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS video_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    video_path TEXT NOT NULL,
    video_filename TEXT NOT NULL,
    caption TEXT DEFAULT '',
    products TEXT DEFAULT '[]',
    status TEXT DEFAULT 'pending',
    error TEXT,
    post_id TEXT,
    video_link TEXT,
    excel_row INTEGER,
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )
`;

db.run(createTableQuery, [], function (err) {
  if (err) {
    console.error("Error creating video_tasks table:", err);
  }
  db.run("PRAGMA journal_mode = WAL;");
  db.run("CREATE INDEX IF NOT EXISTS idx_vt_user_status ON video_tasks(user_id, status);");
  db.run("CREATE INDEX IF NOT EXISTS idx_vt_status ON video_tasks(status);");
  // Auto-reset stuck uploading tasks back to pending on startup
  db.run("UPDATE video_tasks SET status = 'pending' WHERE status = 'uploading';");
});

class VideoTask {
  static async importTasks(tasks) {
    return new Promise((resolve, reject) => {
      // Execute within a single SQLite transaction to speed up disk operations 100x
      db.serialize(() => {
        db.run("BEGIN TRANSACTION", (err) => {
          if (err) return reject(err);
        });

        const stmt = db.prepare(`
          INSERT INTO video_tasks (user_id, username, video_path, video_filename, caption, products, status, excel_row)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        `);

        let hasError = false;
        let lastError = null;

        for (const task of tasks) {
          stmt.run(
            task.user_id,
            task.username,
            task.video_path,
            task.video_filename,
            task.caption || '',
            JSON.stringify(task.product_links || []),
            task.index,
            (err) => {
              if (err) {
                console.error("Error inserting task:", err);
                hasError = true;
                lastError = err;
              }
            }
          );
        }

        stmt.finalize((err) => {
          if (err || hasError) {
            db.run("ROLLBACK");
            return reject(err || lastError || new Error("Failed to insert one or more tasks"));
          }
          
          db.run("COMMIT", (commitErr) => {
            if (commitErr) {
              db.run("ROLLBACK");
              return reject(commitErr);
            }
            resolve(tasks.length);
          });
        });
      });
    });
  }

  static async getNextPendingForUser(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM video_tasks WHERE user_id = ? AND status = 'pending' ORDER BY id LIMIT 1",
        [userId],
        (err, row) => {
          if (err) return reject(err);
          if (row) {
            row.products = JSON.parse(row.products || "[]");
          }
          resolve(row || null);
        }
      );
    });
  }

  static async updateStatus(id, status, details = {}) {
    const sets = ["status = ?"];
    const params = [status];

    if (details.error !== undefined) {
      sets.push("error = ?");
      params.push(details.error);
    }
    if (details.post_id !== undefined) {
      sets.push("post_id = ?");
      params.push(details.post_id);
    }
    if (details.video_link !== undefined) {
      sets.push("video_link = ?");
      params.push(details.video_link);
    }
    if (status === "completed" || status === "failed") {
      sets.push("completed_at = datetime('now', 'localtime')");
    }
    
    params.push(id);

    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE video_tasks SET " + sets.join(", ") + " WHERE id = ?",
        params,
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  static async getStats() {
    return new Promise((resolve, reject) => {
      db.get(
        `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'uploading' THEN 1 ELSE 0 END) as uploading,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM video_tasks
        `,
        [],
        (err, row) => {
          if (err) return reject(err);
          resolve(
            row || {
              total: 0,
              pending: 0,
              uploading: 0,
              completed: 0,
              failed: 0
            }
          );
        }
      );
    });
  }

  static async getStatsByUser() {
    return new Promise((resolve, reject) => {
      db.all(
        `
        SELECT username, user_id,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM video_tasks GROUP BY user_id
        `,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  static async getAll(limit = 200) {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM video_tasks ORDER BY id DESC LIMIT ?",
        [limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  static async deleteAll() {
    return new Promise((resolve, reject) => {
      db.run("DELETE FROM video_tasks", [], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  static async retryAllFailed() {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE video_tasks SET status = 'pending', error = NULL, completed_at = NULL WHERE status = 'failed'",
        [],
        function (err) {
          if (err) return reject(err);
          resolve(this.changes);
        }
      );
    });
  }

  static async getTotalCount() {
    return new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM video_tasks", [], (err, row) => {
        if (err) return reject(err);
        resolve(row?.count || 0);
      });
    });
  }

  static async getPendingCountForUser(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT COUNT(*) as count FROM video_tasks WHERE user_id = ? AND status = ?",
        [userId, "pending"],
        (err, row) => {
          if (err) return reject(err);
          resolve(row?.count || 0);
        }
      );
    });
  }

  static async resetStuckUploadingTasks() {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE video_tasks SET status = 'pending' WHERE status = 'uploading'",
        [],
        function (err) {
          if (err) return reject(err);
          resolve(this.changes);
        }
      );
    });
  }
}

module.exports = VideoTask;
