const db = require('../database/connection').getConnection();

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    cookie TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
  )
`;

db.run(createTableQuery, [], (err) => {
    if (err) {
        console.error('Lỗi khởi tạo bảng users:', err);
        return;
    }
    db.all('PRAGMA table_info(users)', [], (pragmaErr, rows) => {
        if (pragmaErr) return;
        const hasProxy = rows.some(r => r.name === 'proxy');
        const hasCountry = rows.some(r => r.name === 'country');
        const hasIsActive = rows.some(r => r.name === 'is_active');

        if (!hasProxy) {
            db.run("ALTER TABLE users ADD COLUMN proxy TEXT DEFAULT ''");
        }
        if (!hasCountry) {
            db.run("ALTER TABLE users ADD COLUMN country TEXT DEFAULT 'vn'");
        }
        if (!hasIsActive) {
            db.run("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1");
        }
    });
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
}

module.exports = User;