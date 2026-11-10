// Toast function
function showToast(message, type = 'info') {
  const toastEl = document.getElementById('liveToast');
  const toastBody = document.getElementById('toastMessage');
  const toast = new bootstrap.Toast(toastEl);

  toastEl.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'bg-info');

  switch (type) {
    case 'success': toastEl.classList.add('bg-success', 'text-white'); break;
    case 'error': toastEl.classList.add('bg-danger', 'text-white'); break;
    case 'warning': toastEl.classList.add('bg-warning', 'text-dark'); break;
    default: toastEl.classList.add('bg-info', 'text-white');
  }

  toastBody.textContent = message;
  toast.show();
}

// Guard flags
let _fetchingThreads = false;
let _fetchingLogs = false;
let _fetchingTaskStats = false;

// Periodic updates (only when tab is active to save resources)
setInterval(() => {
  if (document.hidden) return;

  const isThreadsActive = document.querySelector('#threads-content.active, #users-content.active');
  if (isThreadsActive && !_fetchingThreads && typeof loadThreads === 'function') {
    _fetchingThreads = true;
    try { loadThreads(); } catch(e) {}
    setTimeout(() => { _fetchingThreads = false; }, 5000);
  }

  const isLogsActive = document.querySelector('#logs-content.active');
  if (isLogsActive && !_fetchingLogs && typeof loadLogs === 'function') {
    _fetchingLogs = true;
    try { loadLogs(); } catch(e) {}
    setTimeout(() => { _fetchingLogs = false; }, 5000);
  }
}, 10000);

// Task stats polling
setInterval(() => {
  if (document.hidden) return;
  if (_fetchingTaskStats) return;
  _fetchingTaskStats = true;
  updateTaskStats().finally(() => { _fetchingTaskStats = false; });
}, 5000);

function updateTaskStats() {
  return fetch('/api/videos/task-stats')
    .then(res => res.json())
    .then(data => {
      if (!data.success) return;
      const s = data.stats;
      const el = (id) => document.getElementById(id);
      if (el('taskTotalCount')) el('taskTotalCount').textContent = s.total || 0;
      if (el('taskPendingCount')) el('taskPendingCount').textContent = s.pending || 0;
      if (el('taskUploadingCount')) el('taskUploadingCount').textContent = s.uploading || 0;
      if (el('taskCompletedCount')) el('taskCompletedCount').textContent = s.completed || 0;
      if (el('taskFailedCount')) el('taskFailedCount').textContent = s.failed || 0;
    })
    .catch(() => {});
}

function loadProxyQueueLockSetting() {
  fetch('/api/config/proxy-queue-lock')
    .then(r => r.json())
    .then(d => {
      const sw1 = document.getElementById('useProxyQueueLockSwitch');
      const sw2 = document.getElementById('settingsProxyQueueLockSwitch');
      if (sw1) sw1.checked = !!d.enabled;
      if (sw2) sw2.checked = !!d.enabled;
    })
    .catch(e => console.error('Error loading proxy queue lock setting:', e));
}

function toggleProxyQueueLock(enabled) {
  fetch('/api/config/proxy-queue-lock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: !!enabled })
  })
    .then(r => r.json())
    .then(d => {
      const sw1 = document.getElementById('useProxyQueueLockSwitch');
      const sw2 = document.getElementById('settingsProxyQueueLockSwitch');
      if (sw1) sw1.checked = !!d.enabled;
      if (sw2) sw2.checked = !!d.enabled;
      showToast(d.message || (d.enabled ? 'Đã BẬT Proxy Queue Lock (Xếp hàng IP)' : 'Đã TẮT Proxy Queue Lock (Chạy tự do ngày xưa)'), 'success');
    })
    .catch(e => {
      console.error(e);
      showToast('Lỗi cập nhật cài đặt Proxy Queue Lock', 'error');
    });
}

document.addEventListener('DOMContentLoaded', () => {
  loadProxyQueueLockSetting();
  updateTaskStats();
  if (typeof loadThreads === 'function') loadThreads();
});
