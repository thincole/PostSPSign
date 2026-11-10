/**
 * Proxy Queue Lock — Xếp hàng tự động theo IP Proxy
 * 
 * Đảm bảo các luồng cùng chia sẻ 1 proxy IP không gửi request
 * createPost đồng thời, tránh bị Shopee rate-limit (429/503).
 * 
 * Mỗi proxy IP có 1 hàng đợi (queue). Khi 1 luồng muốn upload,
 * nó phải "xin phép" qua acquire(proxyKey). Nếu proxy đang bận,
 * luồng sẽ chờ cho đến khi proxy rảnh + khoảng cách tối thiểu
 * (MIN_GAP_MS) giữa 2 request liên tiếp trên cùng proxy.
 */

const MIN_GAP_MS = 8000; // 8 giây giữa 2 request cùng proxy (tối ưu tốc độ)

class ProxyQueue {
  constructor() {
    // Map<proxyKey, { queue: Promise, lastRelease: number }>
    this._locks = new Map();
  }

  /**
   * Lấy proxy key từ thông tin proxy
   * @param {object|null} proxy - { host, port, auth? }
   * @returns {string}
   */
  getKey(proxy) {
    if (!proxy || !proxy.host) return '__no_proxy__';
    return `${proxy.host}:${proxy.port || 80}`;
  }

  /**
   * Xếp hàng chờ proxy rảnh, trả về hàm release() để gọi khi xong
   * @param {string} proxyKey
   * @returns {Promise<Function>} release function
   */
  async acquire(proxyKey) {
    if (!this._locks.has(proxyKey)) {
      this._locks.set(proxyKey, {
        queue: Promise.resolve(),
        lastRelease: 0,
      });
    }

    const lock = this._locks.get(proxyKey);

    let releaseFunc;
    const newQueue = new Promise((resolve) => {
      releaseFunc = () => {
        lock.lastRelease = Date.now();
        resolve();
      };
    });

    // Chain onto existing queue — wait for previous request to finish
    const previousQueue = lock.queue;
    lock.queue = newQueue;

    // Wait for previous request on this proxy to finish
    await previousQueue;

    // Enforce minimum gap between requests on same proxy
    const elapsed = Date.now() - lock.lastRelease;
    if (lock.lastRelease > 0 && elapsed < MIN_GAP_MS) {
      const waitMs = MIN_GAP_MS - elapsed;
      await new Promise((r) => setTimeout(r, waitMs));
    }

    return releaseFunc;
  }

  /**
   * Wrapper tiện lợi: tự động acquire + release sau khi fn() hoàn tất
   * @param {string} proxyKey
   * @param {Function} fn - async function to execute while holding lock
   * @returns {Promise<*>} result of fn()
   */
  async withLock(proxyKey, fn) {
    const release = await this.acquire(proxyKey);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Lấy thống kê hàng đợi (để hiển thị trên UI nếu cần)
   */
  getStats() {
    const stats = {};
    for (const [key, lock] of this._locks.entries()) {
      stats[key] = {
        lastRelease: lock.lastRelease,
        idleSec: lock.lastRelease > 0
          ? Math.round((Date.now() - lock.lastRelease) / 1000)
          : -1,
      };
    }
    return stats;
  }
}

// Singleton — toàn bộ ứng dụng dùng chung 1 instance
const proxyQueue = new ProxyQueue();

module.exports = proxyQueue;
