const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseConnection {
  constructor(dbPath = './database.sqlite') {
    this.db = new sqlite3.Database(
      dbPath,
      sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
      (err) => {
        if (err) {
          console.error('Database connection error:', err);
          throw err;
        } else {
          console.log('Database connected successfully');
          this.configure();
        }
      }
    );
  }

  configure() {
    this.db.serialize(() => {
      // 1. Write-Ahead Logging for high concurrency (multi-reader, non-blocking)
      this.db.run("PRAGMA journal_mode = WAL;");
      // 2. Synchronous = NORMAL balances safety and 10x faster disk write speed
      this.db.run("PRAGMA synchronous = NORMAL;");
      // 3. Busy timeout: wait up to 15 seconds if database is temporarily locked
      this.db.run("PRAGMA busy_timeout = 15000;");
      // 4. Increase RAM cache to 64MB (-64000 KiB) to speed up SELECT queries
      this.db.run("PRAGMA cache_size = -64000;");
      // 5. Keep temporary tables and indices in RAM
      this.db.run("PRAGMA temp_store = MEMORY;");
      // 6. Foreign key enforcement
      this.db.run("PRAGMA foreign_keys = ON;");
    });
  }

  getConnection() {
    return this.db;
  }
}

module.exports = new DatabaseConnection();