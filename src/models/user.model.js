const db = require('../database/connection').getConnection();

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    cookie TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
  )
`;

const MCN_COLUMNS = [
    { name: 'mcn_end_at', def: 'INTEGER DEFAULT NULL' },
    { name: 'mcn_days_left', def: 'INTEGER DEFAULT NULL' },
    { name: 'mcn_name', def: "TEXT DEFAULT ''" },
    { name: 'mcn_status', def: "TEXT DEFAULT ''" },
    { name: 'mcn_checked_at', def: 'INTEGER DEFAULT NULL' }
];

let mcnColumnsReadyPromise = null;

function ensureUserColumns() {
    if (mcnColumnsReadyPromise) return mcnColumnsReadyPromise;
    mcnColumnsReadyPromise = new Promise((resolve) => {
        db.all('PRAGMA table_info(users)', [], (pragmaErr, rows) => {
            if (pragmaErr || !Array.isArray(rows)) return resolve();
            const existing = new Set(rows.map(r => r.name));
            const alters = [];
            if (!existing.has('proxy')) alters.push("ALTER TABLE users ADD COLUMN proxy TEXT DEFAULT ''");
            if (!existing.has('country')) alters.push("ALTER TABLE users ADD COLUMN country TEXT DEFAULT 'vn'");
            if (!existing.has('is_active')) alters.push("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1");
            for (const col of MCN_COLUMNS) {
                if (!existing.has(col.name)) {
                    alters.push(`ALTER TABLE users ADD COLUMN ${col.name} ${col.def}`);
                }
            }
            if (alters.length === 0) return resolve();
            let pending = alters.length;
            for (const sql of alters) {
                db.run(sql, [], () => {
                    pending--;
                    if (pending <= 0) resolve();
                });
            }
        });
    });
    return mcnColumnsReadyPromise;
}

db.run(createTableQuery, [], (err) => {
    if (err) {
        console.error('Lỗi khởi tạo bảng users:', err);
        return;
    }
    ensureUserColumns();
});

class User {
    static getAll() {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT u.*, t.error AS thread_error, t.status AS thread_status 
         FROM users u 
         LEFT JOIN threads t ON u.id = t.user_id`,
                [],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    static create(username, cookie, proxy = '', country = 'vn') {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (username, cookie, proxy, country) VALUES (?, ?, ?, ?)',
                [username, cookie, proxy || '', country || 'vn'],
                function (err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });
    }

    static update(id, username, cookie) {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET username = ?, cookie = ? WHERE id = ?',
                [username, cookie, id],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static updateProxy(id, proxy) {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET proxy = ? WHERE id = ?',
                [proxy || '', id],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static updateCountry(id, country) {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET country = ? WHERE id = ?',
                [country || 'vn', id],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static delete(id) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('DELETE FROM video_tasks WHERE user_id = ?', [id], (err1) => {
                    if (err1) console.error('Error deleting video_tasks for user:', err1);
                });
                db.run('DELETE FROM threads WHERE user_id = ?', [id], (err2) => {
                    if (err2) console.error('Error deleting thread for user:', err2);
                });
                db.run('DELETE FROM users WHERE id = ?', [id], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    }

    static deleteAll() {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('DELETE FROM video_tasks', [], (err1) => {
                    if (err1) console.error('Error deleting video_tasks:', err1);
                });
                db.run('DELETE FROM threads', [], (err2) => {
                    if (err2) console.error('Error deleting threads:', err2);
                });
                db.run('DELETE FROM users', [], (err) => {
                    if (err) return reject(err);
                    db.run("DELETE FROM sqlite_sequence WHERE name IN ('users', 'threads', 'video_tasks')", () => {});
                    resolve();
                });
            });
        });
    }

    static deleteBatch(ids = []) {
        if (!Array.isArray(ids) || ids.length === 0) return Promise.resolve();
        const placeholders = ids.map(() => '?').join(',');
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run(`DELETE FROM video_tasks WHERE user_id IN (${placeholders})`, ids, (err1) => {
                    if (err1) console.error('Error deleting video_tasks for users:', err1);
                });
                db.run(`DELETE FROM threads WHERE user_id IN (${placeholders})`, ids, (err2) => {
                    if (err2) console.error('Error deleting threads for users:', err2);
                });
                db.run(`DELETE FROM users WHERE id IN (${placeholders})`, ids, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    }


    static findByUsername(username) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT u.*, t.error AS thread_error, t.status AS thread_status 
         FROM users u 
         LEFT JOIN threads t ON u.id = t.user_id 
         WHERE u.username = ?`,
                [username],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows && rows.length > 0 ? rows[0] : null);
                }
            );
        });
    }

    static updateUsername(id, username) {
        return new Promise((resolve, reject) => {
            db.run('UPDATE users SET username = ? WHERE id = ?', [username, id], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    static updateCookie(id, cookie) {
        return new Promise((resolve, reject) => {
            db.run('UPDATE users SET cookie = ? WHERE id = ?', [cookie, id], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    static updateIsActive(id, isActive) {
        return new Promise((resolve, reject) => {
            db.run('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    static ensureMcnColumns() {
        return ensureUserColumns();
    }

    static updateMcnInfo(id, info = {}) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE users
                 SET mcn_end_at = ?, mcn_days_left = ?, mcn_name = ?, mcn_status = ?, mcn_checked_at = ?
                 WHERE id = ?`,
                [
                    info.mcn_end_at ?? null,
                    info.mcn_days_left ?? null,
                    info.mcn_name || '',
                    info.mcn_status || '',
                    info.mcn_checked_at ?? null,
                    id
                ],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static getForMcnCheck(userIds = []) {
        return new Promise((resolve, reject) => {
            const hasIds = Array.isArray(userIds) && userIds.length > 0;
            const placeholders = hasIds ? userIds.map(() => '?').join(',') : '';
            const sql = `
                SELECT u.id, u.username, u.cookie, u.proxy, u.country, u.is_active,
                       u.mcn_end_at, u.mcn_days_left, u.mcn_name, u.mcn_status, u.mcn_checked_at,
                       MAX(t.proxy_host) AS thread_proxy_host,
                       MAX(t.proxy_port) AS thread_proxy_port,
                       MAX(t.proxy_username) AS thread_proxy_username,
                       MAX(t.proxy_password) AS thread_proxy_password
                FROM users u
                LEFT JOIN threads t ON u.id = t.user_id
                ${hasIds ? `WHERE u.id IN (${placeholders})` : ''}
                GROUP BY u.id
                ORDER BY u.id ASC
            `;
            db.all(sql, hasIds ? userIds : [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }
}

module.exports = User;