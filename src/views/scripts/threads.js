// Country list - đồng bộ với src/utils/country.js
const COUNTRY_LIST = [
  { code: 'vn', flag: '🇻🇳', name: 'Việt Nam', tld: 'vn' },
  { code: 'sg', flag: '🇸🇬', name: 'Singapore', tld: 'sg' },
  { code: 'ph', flag: '🇵🇭', name: 'Philippines', tld: 'ph' },
  { code: 'id', flag: '🇮🇩', name: 'Indonesia', tld: 'co.id' },
  { code: 'th', flag: '🇹🇭', name: 'Thailand', tld: 'co.th' },
  { code: 'my', flag: '🇲🇾', name: 'Malaysia', tld: 'com.my' },
  { code: 'br', flag: '🇧🇷', name: 'Brazil', tld: 'com.br' },
];
function getCountryDisplay(code) {
  const c = COUNTRY_LIST.find(x => x.code === (code || 'vn').toLowerCase()) || COUNTRY_LIST[0];
  return `${c.flag} ${c.code.toUpperCase()}`;
}

// Lưu kết quả check 24h để không mất khi loadThreads() render lại
const _check24hCache = {};

function check24h(threadId) {
  const btn = document.getElementById('check24hBtn_' + threadId);
  const result = document.getElementById('check24hResult_' + threadId);
  if (btn) btn.disabled = true;
  if (result) result.textContent = '...';

  fetch(`/api/threads/${threadId}/check-24h`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        _check24hCache[threadId] = { count: data.count24h, userName: data.userName, canPost: data.canPost, success: true };
        applyCheck24hResult(threadId);
        const postStatus = data.canPost ? '' : ' | BỊ HẠN CHẾ';
        showToast(`${data.userName}: ${data.count24h} video/24h${postStatus}`, data.canPost ? (data.count24h >= 20 ? 'warning' : 'success') : 'error');
      } else {
        const isBanned = (data.error || '').includes('hạn chế') || (data.error || '').includes('khóa') || (data.error || '').includes('ban');
        _check24hCache[threadId] = { error: data.error, success: false, banned: isBanned };
        applyCheck24hResult(threadId);
        showToast(data.error, 'error');
      }
    })
    .catch(() => {
      _check24hCache[threadId] = { error: 'Lỗi kết nối', success: false };
      applyCheck24hResult(threadId);
      showToast('Lỗi kết nối check 24h', 'error');
    })
    .finally(() => {
      if (btn) btn.disabled = false;
    });
}

function applyCheck24hResult(threadId) {
  const cached = _check24hCache[threadId];
  if (!cached) return;
  const btn = document.getElementById('check24hBtn_' + threadId);
  const result = document.getElementById('check24hResult_' + threadId);
  if (!btn || !result) return;

  if (cached.success) {
    const c = cached.count;
    if (!cached.canPost) {
      btn.className = 'btn btn-sm btn-dark';
      result.textContent = `${c}/BAN`;
      btn.title = `${cached.userName}: ${c} video/24h - BỊ HẠN CHẾ ĐĂNG`;
    } else {
      btn.className = `btn btn-sm ${c >= 20 ? 'btn-danger' : c >= 10 ? 'btn-warning' : 'btn-outline-info'}`;
      result.textContent = c;
      btn.title = `${cached.userName}: ${c} video trong 24h`;
    }
  } else if (cached.banned) {
    btn.className = 'btn btn-sm btn-dark';
    result.textContent = 'BAN';
    btn.title = cached.error;
  } else {
    btn.className = 'btn btn-sm btn-outline-danger';
    result.textContent = '!';
    btn.title = cached.error;
  }
}

// Restore kết quả sau mỗi lần loadThreads render lại
function restoreAllCheck24h() {
  for (const threadId of Object.keys(_check24hCache)) {
    applyCheck24hResult(threadId);
  }
}

async function checkAll24h() {
  const selected = Array.from(document.querySelectorAll('.thread-checkbox:checked'))
    .map(cb => cb.dataset.threadId)
    .filter(id => id !== undefined);

  if (selected.length === 0) {
    showToast('Chọn ít nhất 1 luồng để check', 'warning');
    return;
  }

  showToast(`Đang check ${selected.length} luồng...`, 'info');

  for (const threadId of selected) {
    check24h(threadId);
    // Delay 500ms giữa mỗi request tránh spam
    await new Promise(r => setTimeout(r, 500));
  }
}

// Countdown timer cho delay
function updateCountdowns() {
  const now = Math.floor(Date.now() / 1000);
  document.querySelectorAll('[id^="countdown_"]').forEach(el => {
    const nextRun = parseInt(el.dataset.next || '0');
    const remaining = nextRun - now;
    if (remaining > 0) {
      el.textContent = `${remaining}s`;
      el.className = 'badge bg-warning text-dark';
      el.style.fontSize = '0.6rem';
    } else {
      el.textContent = 'Sẵn sàng';
      el.className = 'badge bg-success';
      el.style.fontSize = '0.6rem';
    }
  });
}

// Update countdown mỗi giây
setInterval(updateCountdowns, 1000);

function showCreateThreadModal() {
  const modal = new bootstrap.Modal(
    document.getElementById('createThreadModal')
  );
  modal.show();
}

let _cachedThreads = [];
let _threadCurrentPage = 1;
let _threadPageSize = 50;

function onThreadFilterChange() {
  _threadCurrentPage = 1;
  renderThreadTable();
}

function onThreadPageSizeChange(newSize) {
  _threadPageSize = parseInt(newSize, 10) || 50;
  _threadCurrentPage = 1;
  renderThreadTable();
}

function setThreadPage(page) {
  _threadCurrentPage = page;
  renderThreadTable();
}

function loadThreads() {
  // Do not re-render table if user is focused inside threadTable
  const activeEl = document.activeElement;
  if (activeEl && activeEl.closest('#threadTable')) {
    return;
  }

  fetch('/api/threads')
    .then((response) => response.json())
    .then((threads) => {
      _cachedThreads = threads || [];
      renderThreadTable();
      if (typeof updateTaskStats === 'function') updateTaskStats();
    })
    .catch((error) => console.error('Error loading threads:', error));
}

function renderThreadTable() {
  const threads = _cachedThreads || [];
  const searchVal = (document.getElementById('threadSearchInput')?.value || '').trim().toLowerCase();
  const countryVal = document.getElementById('threadCountryFilter')?.value || 'all';
  const statusVal = document.getElementById('threadStatusFilter')?.value || 'all';

  let filtered = threads;

  if (countryVal !== 'all') {
    filtered = filtered.filter(t => (t.country || 'vn').toLowerCase() === countryVal.toLowerCase());
  }

  if (searchVal) {
    filtered = filtered.filter(t => {
      const uMatch = (t.username || '').toLowerCase().includes(searchVal);
      const cMatch = (t.country || '').toLowerCase() === searchVal;
      // Tránh việc search "id" bị khớp nhầm đuôi tên miền proxy ".id.vn" của tài khoản PH/VN
      let pMatch = false;
      if (t.proxy_host) {
        const pHost = t.proxy_host.toLowerCase();
        if (searchVal === 'id' || searchVal === 'vn' || searchVal === 'ph' || searchVal === 'my') {
          pMatch = false; // Khi tìm mã quốc gia ngắn, không tìm trong domain proxy
        } else {
          pMatch = pHost.includes(searchVal);
        }
      }
      const eMatch = (t.error || '').toLowerCase().includes(searchVal);
      return uMatch || cMatch || pMatch || eMatch;
    });
  }

  if (statusVal !== 'all') {
    filtered = filtered.filter(t => t.status === statusVal);
  }

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / _threadPageSize));
  if (_threadCurrentPage > totalPages) _threadCurrentPage = totalPages;

  const startIdx = (_threadCurrentPage - 1) * _threadPageSize;
  const pageThreads = filtered.slice(startIdx, startIdx + _threadPageSize);

  // Update summary count label
  const summaryEl = document.getElementById('threadCountSummary');
  if (summaryEl) {
    summaryEl.textContent = `Hiển thị ${pageThreads.length}/${totalFiltered} (Tổng ${threads.length} luồng)`;
  }

  // Update pagination controls
  const navContainer = document.getElementById('threadPaginationControls');
  if (navContainer) {
    if (totalPages <= 1) {
      navContainer.innerHTML = '';
    } else {
      let pageBtns = '';
      pageBtns += `<button class="btn btn-sm btn-outline-secondary ${ _threadCurrentPage <= 1 ? 'disabled' : '' }" onclick="setThreadPage(${_threadCurrentPage - 1})"><i class="bi bi-chevron-left"></i></button>`;
      pageBtns += `<span class="small px-2 fw-semibold">Trang ${_threadCurrentPage} / ${totalPages}</span>`;
      pageBtns += `<button class="btn btn-sm btn-outline-secondary ${ _threadCurrentPage >= totalPages ? 'disabled' : '' }" onclick="setThreadPage(${_threadCurrentPage + 1})"><i class="bi bi-chevron-right"></i></button>`;
      navContainer.innerHTML = pageBtns;
    }
  }

  // Store currently selected thread IDs
  const selectedThreadIds = Array.from(
    document.querySelectorAll('.thread-checkbox:checked')
  ).map((checkbox) => checkbox.dataset.threadId);

  const threadTable = document.getElementById('threadTable');
  if (!threadTable) return;

  threadTable.innerHTML = pageThreads
    .map((thread, index) => {
      const globalIndex = startIdx + index + 1;
      let proxyStr = '-';
      if (thread.proxy_host && thread.proxy_port) {
        proxyStr = `${thread.proxy_host}:${thread.proxy_port}`;
        if (thread.proxy_username) proxyStr += `:${thread.proxy_username}:***`;
      }

      const statusMap = {
        stop: { badge: 'bg-secondary', icon: 'bi-stop-circle', label: 'Dừng' },
        done: { badge: 'bg-success', icon: 'bi-check-circle', label: 'Xong' },
        error: { badge: 'bg-danger', icon: 'bi-x-circle', label: 'Lỗi' },
        inprogress: { badge: 'bg-primary', icon: 'bi-play-circle', label: 'Đang chạy' },
      };
      const st = statusMap[thread.status] || { badge: 'bg-secondary', icon: '', label: thread.status };
      const isChecked = selectedThreadIds.includes(thread.id.toString()) ? 'checked' : '';
      const isStopped = ['stop', 'done', 'error'].includes(thread.status);
      const cookiePreview = thread.cookie ? thread.cookie.substring(0, 25) + '...' : '-';

      return `
          <tr id="threadRow_${thread.id}">
              <td>
                <div class="form-check form-switch mb-0">
                  <input type="checkbox" class="form-check-input thread-checkbox"
                        data-thread-id="${thread.id}"
                        data-thread-status="${thread.status}"
                        data-thread-pending="${Math.max(0, thread.count_video_upload - thread.videos_uploaded)}"
                        id="threadCheckbox${thread.id}" ${isChecked}>
                </div>
              </td>
              <td class="text-muted">${globalIndex}</td>
              <td>
                <span id="usernameDisplay_${thread.user_id}" class="d-flex align-items-center gap-1">
                  <strong>${thread.username}</strong>${thread.upload_mode === 'duet' ? ' <span class="badge bg-info" style="font-size:0.6rem">DUET</span>' : thread.upload_mode === 'auto' ? ' <span class="badge bg-warning text-dark" style="font-size:0.6rem">AUTO</span>' : ''}${thread.auto_fill_products ? ' <span class="badge bg-success" style="font-size:0.6rem">+SP</span>' : ''}
                  <button class="btn btn-sm p-0 text-primary" onclick="toggleEditUsername(${thread.user_id}, '${thread.username}')" title="Sửa username">
                    <i class="bi bi-pencil-square" style="font-size:0.7rem"></i>
                  </button>
                </span>
                <div id="usernameEdit_${thread.user_id}" class="d-none">
                  <div class="input-group input-group-sm">
                    <input type="text" class="form-control form-control-sm" value="${thread.username}" id="usernameInput_${thread.user_id}" style="min-width:70px">
                    <button class="btn btn-success btn-sm" onclick="saveThreadUsername(${thread.user_id})"><i class="bi bi-check"></i></button>
                    <button class="btn btn-secondary btn-sm" onclick="cancelEditUsername(${thread.user_id})"><i class="bi bi-x"></i></button>
                  </div>
                </div>
              </td>
              <td>
                <div class="d-flex align-items-center gap-1">
                  <code class="small text-truncate" style="max-width:115px;display:inline-block" title="${cookiePreview}">${cookiePreview}</code>
                  <button class="btn btn-sm p-0 text-primary" onclick="editThreadUserCookieForm(${thread.user_id}, '${thread.username}')" title="Sửa cookie thủ công">
                    <i class="bi bi-pencil-square" style="font-size:0.7rem"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-warning text-dark py-0 px-1" onclick="recoverSingleThreadCookie(${thread.id}, this)" title="Tự động làm mới / Lấy lại Cookie từ GemLogin cho luồng ${thread.username}" style="font-size:0.65rem; height:18px; display:inline-flex; align-items:center;">
                    <i class="bi bi-key-fill" style="font-size:0.7rem"></i>
                  </button>
                </div>
              </td>
              <td>
                <span id="countryDisplay_${thread.id}" class="d-flex align-items-center gap-1">
                  <span class="badge bg-light text-dark border" title="${(thread.country || 'vn').toUpperCase()}">${getCountryDisplay(thread.country)}</span>
                  <button class="btn btn-sm p-0 text-primary" onclick="toggleEditCountry(${thread.id}, '${thread.country || 'vn'}')" title="Đổi nước">
                    <i class="bi bi-pencil-square" style="font-size:0.7rem"></i>
                  </button>
                </span>
                <div id="countryEdit_${thread.id}" class="d-none">
                  <div class="input-group input-group-sm">
                    <select class="form-select form-select-sm" id="countryInput_${thread.id}" style="min-width:80px">
                      ${COUNTRY_LIST.map(c => `<option value="${c.code}" ${(thread.country || 'vn') === c.code ? 'selected' : ''}>${c.flag} ${c.code.toUpperCase()}</option>`).join('')}
                    </select>
                    <button class="btn btn-success btn-sm" onclick="saveThreadCountry(${thread.id})"><i class="bi bi-check"></i></button>
                    <button class="btn btn-secondary btn-sm" onclick="cancelEditCountry(${thread.id})"><i class="bi bi-x"></i></button>
                  </div>
                </div>
              </td>
              <td>
                <a href="#" class="text-decoration-none small" onclick="showThreadTasks(${thread.user_id}, '${thread.username}'); return false;" title="Xem danh sách video">
                  <i class="bi bi-list-ul me-1"></i>${thread.count_video_upload} video
                </a>
              </td>
              <td>
                <strong>${thread.videos_uploaded}</strong><small class="text-muted">/${thread.count_video_upload}</small>
              </td>
              <td><span class="badge ${(thread.count_video_upload - thread.videos_uploaded) > 0 ? 'bg-warning text-dark' : 'bg-success'}">${Math.max(0, thread.count_video_upload - thread.videos_uploaded)}</span></td>
              <td>
                <span id="delayDisplay_${thread.id}" class="d-flex align-items-center gap-1">
                  <small>${thread.delay_min || 186}-${thread.delay_max || 245}s</small>
                  <button class="btn btn-sm p-0 text-primary" onclick="toggleEditDelay(${thread.id}, ${thread.delay_min || 186}, ${thread.delay_max || 245})" title="Sửa delay luồng này">
                    <i class="bi bi-pencil-square" style="font-size:0.7rem"></i>
                  </button>
                </span>
                <div id="delayEdit_${thread.id}" class="d-none mt-1">
                  <div class="input-group input-group-sm" style="max-width:135px;">
                    <input type="number" class="form-control px-1" id="delayMinInput_${thread.id}" value="${thread.delay_min || 186}" style="font-size:0.7rem">
                    <span class="input-group-text px-1">-</span>
                    <input type="number" class="form-control px-1" id="delayMaxInput_${thread.id}" value="${thread.delay_max || 245}" style="font-size:0.7rem">
                    <button class="btn btn-success btn-sm px-1" onclick="saveThreadDelay(${thread.id})"><i class="bi bi-check"></i></button>
                    <button class="btn btn-secondary btn-sm px-1" onclick="cancelEditDelay(${thread.id})"><i class="bi bi-x"></i></button>
                  </div>
                </div>
                ${thread.status === 'inprogress' ? `<span class="badge bg-warning text-dark" style="font-size:0.6rem" id="countdown_${thread.id}" data-next="${thread.next_run_at || 0}"></span>` : ''}
              </td>
              <td>
                <span id="proxyDisplay_${thread.id}" class="d-flex align-items-center gap-1">
                  <code class="small">${proxyStr}</code>
                  <button class="btn btn-sm p-0 text-primary" onclick="toggleEditProxy(${thread.id}, '${thread.proxy_host || ''}', '${thread.proxy_port || ''}', '${thread.proxy_username || ''}', '${thread.proxy_password || ''}')" title="Sửa proxy">
                    <i class="bi bi-pencil-square" style="font-size:0.7rem"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-success py-0 px-1 ms-1" onclick="changeRandomProxy(${thread.id})" title="Đổi proxy ngẫu nhiên" style="font-size:0.65rem; height:18px; display:inline-flex; align-items:center;">
                    <i class="bi bi-arrow-repeat me-1" style="font-size:0.7rem"></i>Đổi Proxy
                  </button>
                </span>
                <div id="proxyEdit_${thread.id}" class="d-none">
                  <div class="input-group input-group-sm">
                    <input type="text" class="form-control form-control-sm" id="proxyInput_${thread.id}" placeholder="IP:PORT:USER:PASS" style="min-width:120px">
                    <button class="btn btn-success btn-sm" onclick="saveThreadProxy(${thread.id})"><i class="bi bi-check"></i></button>
                    <button class="btn btn-secondary btn-sm" onclick="cancelEditProxy(${thread.id})"><i class="bi bi-x"></i></button>
                  </div>
                </div>
              </td>
              <td class="log-error-cell" title="${thread.error || ''}">${thread.error || '<span class="text-muted">-</span>'}</td>
              <td>
                  <span class="badge ${st.badge}">
                      <i class="bi ${st.icon} me-1"></i>${st.label}
                  </span>
              </td>
              <td class="text-nowrap">
                  <button class="btn btn-sm ${isStopped ? 'btn-success' : 'btn-warning'}" onclick="toggleThreadStatus(${thread.id})" title="${isStopped ? 'Bắt đầu' : 'Dừng'}">
                      <i class="bi ${isStopped ? 'bi-play-fill' : 'bi-pause-fill'}"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-info" onclick="check24h(${thread.id})" title="Check video 24h" id="check24hBtn_${thread.id}">
                      <i class="bi bi-clock-history"></i> <span id="check24hResult_${thread.id}"></span>
                  </button>
                  <button class="btn btn-sm btn-outline-danger" onclick="deleteThread(${thread.id})" title="Xóa">
                      <i class="bi bi-trash3"></i>
                  </button>
              </td>
          </tr>`;
    })
    .join('');

  // Restore the "Select All" checkbox state if all threads are selected
  const selectAllCheckbox = document.getElementById('selectAllThreads');
  const threadCheckboxes = document.querySelectorAll(
    '.thread-checkbox:not(:disabled)'
  );
  if (selectAllCheckbox) {
    selectAllCheckbox.checked =
      threadCheckboxes.length > 0 &&
      Array.from(threadCheckboxes).every((checkbox) =>
        selectedThreadIds.includes(checkbox.dataset.threadId)
      );
  }

  // Restore kết quả check 24h sau khi render lại
  restoreAllCheck24h();
  // Update countdown timers
  updateCountdowns();
}

// === Username inline edit ===
function toggleEditUsername(userId, currentVal) {
  document.getElementById('usernameDisplay_' + userId).classList.add('d-none');
  document.getElementById('usernameEdit_' + userId).classList.remove('d-none');
  document.getElementById('usernameInput_' + userId).value = currentVal;
  document.getElementById('usernameInput_' + userId).focus();
}
function cancelEditUsername(userId) {
  document.getElementById('usernameDisplay_' + userId).classList.remove('d-none');
  document.getElementById('usernameEdit_' + userId).classList.add('d-none');
}
function saveThreadUsername(userId) {
  const newUsername = document.getElementById('usernameInput_' + userId).value.trim();
  if (!newUsername) {
    showToast('Username không được để trống', 'error');
    return;
  }
  fetch(`/api/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: newUsername }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        showToast('Cập nhật username thành công', 'success');
        loadThreads();
        loadUsers();
      } else {
        showToast(data.message || 'Lỗi cập nhật username', 'error');
      }
    })
    .catch(() => showToast('Lỗi cập nhật username', 'error'));
}

// === Uploaded inline edit ===
function toggleEditUploaded(threadId, currentVal) {
  document.getElementById('uploadedDisplay_' + threadId).classList.add('d-none');
  document.getElementById('uploadedEdit_' + threadId).classList.remove('d-none');
  document.getElementById('uploadedInput_' + threadId).value = currentVal;
  document.getElementById('uploadedInput_' + threadId).focus();
}
function cancelEditUploaded(threadId) {
  document.getElementById('uploadedDisplay_' + threadId).classList.remove('d-none');
  document.getElementById('uploadedEdit_' + threadId).classList.add('d-none');
}
function saveThreadUploaded(threadId) {
  const count = parseInt(document.getElementById('uploadedInput_' + threadId).value, 10);
  if (isNaN(count) || count < 0) {
    showToast('Số không hợp lệ', 'error');
    return;
  }
  fetch(`/api/threads/${threadId}/videos-uploaded`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videos_uploaded: count }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        showToast(`Đã cập nhật uploaded = ${count}`, 'success');
        loadThreads();
      } else {
        showToast(data.error || 'Lỗi cập nhật', 'error');
      }
    })
    .catch(() => showToast('Lỗi cập nhật', 'error'));
}

// === Country inline edit ===
function toggleEditCountry(threadId, currentCode) {
  document.getElementById('countryDisplay_' + threadId).classList.add('d-none');
  document.getElementById('countryEdit_' + threadId).classList.remove('d-none');
  const sel = document.getElementById('countryInput_' + threadId);
  if (sel) sel.value = currentCode || 'vn';
}
function cancelEditCountry(threadId) {
  document.getElementById('countryDisplay_' + threadId).classList.remove('d-none');
  document.getElementById('countryEdit_' + threadId).classList.add('d-none');
}
function saveThreadCountry(threadId) {
  const country = document.getElementById('countryInput_' + threadId).value;
  fetch(`/api/threads/${threadId}/country`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('Cập nhật quốc gia thành công', 'success');
        loadThreads();
      } else {
        showToast(data.error || 'Lỗi cập nhật quốc gia', 'error');
      }
    })
    .catch(() => showToast('Lỗi cập nhật quốc gia', 'error'));
}

// === Delay inline edit ===
function toggleEditDelay(threadId, minVal, maxVal) {
  document.getElementById('delayDisplay_' + threadId).classList.add('d-none');
  document.getElementById('delayEdit_' + threadId).classList.remove('d-none');
  document.getElementById('delayMinInput_' + threadId).value = minVal;
  document.getElementById('delayMaxInput_' + threadId).value = maxVal;
}
function cancelEditDelay(threadId) {
  document.getElementById('delayDisplay_' + threadId).classList.remove('d-none');
  document.getElementById('delayEdit_' + threadId).classList.add('d-none');
}
function saveThreadDelay(threadId) {
  const minVal = document.getElementById('delayMinInput_' + threadId).value;
  const maxVal = document.getElementById('delayMaxInput_' + threadId).value;
  fetch(`/api/threads/${threadId}/delay`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delay_min: minVal, delay_max: maxVal }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('Cập nhật delay luồng thành công', 'success');
        loadThreads();
      } else {
        showToast(data.error || 'Lỗi cập nhật delay', 'error');
      }
    })
    .catch(() => showToast('Lỗi kết nối', 'error'));
}

function applyDelayToAllThreadsFromInput() {
  const minVal = document.getElementById('countryImportDelayMin')?.value || '186';
  const maxVal = document.getElementById('countryImportDelayMax')?.value || '245';

  fetch('/api/threads/batch-delay', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delay_min: minVal, delay_max: maxVal, threadIds: [] }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast(`⚡ Đã cập nhật Delay (${minVal}-${maxVal}s) cho TOÀN BỘ các luồng thành công!`, 'success');
        loadThreads();
      } else {
        showToast(data.error || 'Lỗi cập nhật delay', 'error');
      }
    })
    .catch(() => showToast('Lỗi kết nối khi cập nhật delay', 'error'));
}

function showBatchDelayModal() {
  const modal = new bootstrap.Modal(document.getElementById('batchDelayModal'));
  modal.show();
}

function saveBatchDelay() {
  const minVal = document.getElementById('batchDelayMinInput').value;
  const maxVal = document.getElementById('batchDelayMaxInput').value;
  const onlySelected = document.getElementById('batchDelayOnlySelectedCheck').checked;

  let threadIds = [];
  if (onlySelected) {
    threadIds = Array.from(document.querySelectorAll('.thread-checkbox:checked'))
      .map(cb => cb.dataset.threadId)
      .filter(id => id !== undefined);
    if (threadIds.length === 0) {
      showToast('Chưa chọn luồng nào để áp dụng', 'warning');
      return;
    }
  }

  fetch('/api/threads/batch-delay', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delay_min: minVal, delay_max: maxVal, threadIds }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast(data.message, 'success');
        const modal = bootstrap.Modal.getInstance(document.getElementById('batchDelayModal'));
        if (modal) modal.hide();
        loadThreads();
      } else {
        showToast(data.error || 'Lỗi cập nhật delay hàng loạt', 'error');
      }
    })
    .catch(() => showToast('Lỗi kết nối khi cập nhật delay', 'error'));
}

// === Proxy inline edit ===
function toggleEditProxy(threadId, host, port, username, password) {
  document.getElementById('proxyDisplay_' + threadId).classList.add('d-none');
  document.getElementById('proxyEdit_' + threadId).classList.remove('d-none');
  const input = document.getElementById('proxyInput_' + threadId);
  if (host && port) {
    let val = host + ':' + port;
    if (username && password) val += ':' + username + ':' + password;
    input.value = val;
  } else {
    input.value = '';
  }
  input.focus();
}
function cancelEditProxy(threadId) {
  document.getElementById('proxyDisplay_' + threadId).classList.remove('d-none');
  document.getElementById('proxyEdit_' + threadId).classList.add('d-none');
}
function saveThreadProxy(threadId) {
  const proxy = document.getElementById('proxyInput_' + threadId).value.trim();
  fetch(`/api/threads/${threadId}/proxy`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proxy }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('Cập nhật proxy thành công', 'success');
        loadThreads();
        if (typeof loadUsers === 'function') loadUsers();
      } else {
        showToast(data.error || 'Lỗi cập nhật proxy', 'error');
      }
    })
    .catch(() => showToast('Lỗi cập nhật proxy', 'error'));
}

function changeRandomProxy(threadId) {
  fetch(`/api/threads/${threadId}/random-proxy`, {
    method: 'PUT',
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('Đổi proxy ngẫu nhiên thành công', 'success');
        loadThreads();
        if (typeof loadUsers === 'function') loadUsers();
      } else {
        showToast(data.error || 'Lỗi đổi proxy', 'error');
      }
    })
    .catch(() => showToast('Lỗi đổi proxy', 'error'));
}

function deleteThread(id) {
  if (confirm('Bạn có chắc chắn muốn xóa luồng này không?')) {
    // Optimistically remove row from DOM immediately (0ms response)
    const row = document.getElementById('threadRow_' + id);
    if (row) row.remove();
    _cachedThreads = _cachedThreads.filter(t => t.id !== id);
    showToast('🗑️ Đang xóa luồng...', 'info');

    fetch(`/api/threads/${id}`, {
      method: 'DELETE',
    })
      .then((response) => response.json())
      .then((data) => {
        showToast('Xóa luồng thành công', 'success');
        loadUsers();
        loadThreads();
      })
      .catch((error) => {
        console.error('Error:', error);
        showToast('Lỗi khi xóa luồng', 'error');
        loadThreads();
      });
  }
}

function toggleThreadStatus(id) {
  const row = document.getElementById('threadRow_' + id);
  const btn = row ? row.querySelector('td:last-child button:first-child') : null;
  const statusBadge = row ? row.querySelector('td:nth-last-child(2) span.badge') : null;

  // Optimistic UI update (0ms instant response)
  if (btn && statusBadge) {
    const isCurrentlyStopped = btn.classList.contains('btn-success');
    if (isCurrentlyStopped) {
      btn.className = 'btn btn-sm btn-warning';
      btn.innerHTML = '<i class="bi bi-pause-fill"></i>';
      btn.title = 'Dừng';
      statusBadge.className = 'badge bg-primary';
      statusBadge.innerHTML = '<i class="bi bi-play-circle me-1"></i>Đang chạy';
    } else {
      btn.className = 'btn btn-sm btn-success';
      btn.innerHTML = '<i class="bi bi-play-fill"></i>';
      btn.title = 'Bắt đầu';
      statusBadge.className = 'badge bg-secondary';
      statusBadge.innerHTML = '<i class="bi bi-stop-circle me-1"></i>Dừng';
    }
  }

  fetch(`/api/threads/${id}/toggle-status`, {
    method: 'PUT',
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        showToast('Trạng thái luồng được cập nhật thành công', 'success');
        // Update memory cache
        const t = _cachedThreads.find(x => x.id === id);
        if (t) t.status = data.status;
      } else {
        showToast(data.error || 'Lỗi cập nhật', 'error');
        loadThreads();
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      showToast('Lỗi khi cập nhật trạng thái luồng', 'error');
      loadThreads();
    });
}

function toggleAllThreads(checkbox) {
  const threadCheckboxes = document.querySelectorAll(
    '.thread-checkbox:not(:disabled)'
  );
  threadCheckboxes.forEach((box) => {
    box.checked = checkbox.checked;
  });
}

function startSelectedThreads() {
  const selectedThreads = Array.from(
    document.querySelectorAll('.thread-checkbox:checked')
  )
    .filter((checkbox) => checkbox.dataset.threadStatus !== 'inprogress')
    .map((checkbox) => checkbox.dataset.threadId)
    .filter((id) => id !== undefined);

  if (selectedThreads.length === 0) {
    showToast('Vui lòng chọn ít nhất một luồng để bắt đầu', 'warning');
    return;
  }

  showToast(`⚡ Đang bắt đầu ${selectedThreads.length} luồng...`, 'info');

  // Optimistic UI updates
  selectedThreads.forEach(id => {
    const row = document.getElementById('threadRow_' + id);
    if (row) {
      const btn = row.querySelector('td:last-child button:first-child');
      const badge = row.querySelector('td:nth-last-child(2) span.badge');
      if (btn) {
        btn.className = 'btn btn-sm btn-warning';
        btn.innerHTML = '<i class="bi bi-pause-fill"></i>';
      }
      if (badge) {
        badge.className = 'badge bg-primary';
        badge.innerHTML = '<i class="bi bi-play-circle me-1"></i>Đang chạy';
      }
    }
  });

  // Fast single batch API call
  fetch('/api/threads/batch-status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'inprogress', threadIds: selectedThreads })
  })
    .then(res => res.json())
    .then((data) => {
      if (data.success) {
        showToast(data.message || 'Các luồng đã chọn được bắt đầu thành công', 'success');
        document.getElementById('selectAllThreads').checked = false;
        loadThreads();
      } else {
        showToast(data.error || 'Lỗi bắt đầu luồng', 'error');
        loadThreads();
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      showToast('Lỗi khi bắt đầu các luồng', 'error');
      loadThreads();
    });
}

function pauseSelectedThreads() {
  const selectedThreads = Array.from(
    document.querySelectorAll('.thread-checkbox:checked')
  )
    .filter((checkbox) => checkbox.dataset.threadStatus === 'inprogress')
    .map((checkbox) => checkbox.dataset.threadId)
    .filter((id) => id !== undefined);

  if (selectedThreads.length === 0) {
    showToast('Vui lòng chọn ít nhất một luồng để tạm dừng', 'warning');
    return;
  }

  showToast(`⏸️ Đang tạm dừng ${selectedThreads.length} luồng...`, 'info');

  // Optimistic UI updates
  selectedThreads.forEach(id => {
    const row = document.getElementById('threadRow_' + id);
    if (row) {
      const btn = row.querySelector('td:last-child button:first-child');
      const badge = row.querySelector('td:nth-last-child(2) span.badge');
      if (btn) {
        btn.className = 'btn btn-sm btn-success';
        btn.innerHTML = '<i class="bi bi-play-fill"></i>';
      }
      if (badge) {
        badge.className = 'badge bg-secondary';
        badge.innerHTML = '<i class="bi bi-stop-circle me-1"></i>Dừng';
      }
    }
  });

  // Fast single batch API call
  fetch('/api/threads/batch-status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'stop', threadIds: selectedThreads })
  })
    .then(res => res.json())
    .then((data) => {
      if (data.success) {
        showToast(data.message || 'Các luồng đã chọn được tạm dừng thành công', 'success');
        document.getElementById('selectAllThreads').checked = false;
        loadThreads();
      } else {
        showToast(data.error || 'Lỗi tạm dừng luồng', 'error');
        loadThreads();
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      showToast('Lỗi khi tạm dừng các luồng', 'error');
      loadThreads();
    });
}

// Xóa nhiều luồng trong 1 request thay vì gửi N request DELETE song song
function deleteThreadsBatch(ids) {
  return fetch('/api/threads/delete-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadIds: ids }),
  })
    .then(r => r.json())
    .then(data => {
      if (!data.success) throw new Error(data.error || 'Xóa luồng thất bại');
      return data;
    });
}

function deleteSelectedThreads() {
  const selectedThreads = Array.from(
    document.querySelectorAll('.thread-checkbox:checked')
  )
    .map((checkbox) => checkbox.dataset.threadId)
    .filter((id) => id !== undefined);

  if (selectedThreads.length === 0) {
    showToast('Vui lòng chọn ít nhất một luồng để xóa', 'warning');
    return;
  }

  if (confirm(`Bạn có chắc chắn muốn xóa ${selectedThreads.length} luồng đã chọn không?`)) {
    showToast(`🗑️ Đang xóa ${selectedThreads.length} luồng...`, 'info');

    // Optimistically remove from DOM
    _cachedThreads = _cachedThreads.filter(t => !selectedThreads.includes(t.id.toString()));
    renderThreadTable();

    deleteThreadsBatch(selectedThreads)
      .then(() => {
        showToast('Các luồng đã chọn được xóa thành công', 'success');
        document.getElementById('selectAllThreads').checked = false;
        loadThreads();
        loadUsers();
      })
      .catch((error) => {
        console.error('Error:', error);
        showToast('Lỗi khi xóa các luồng', 'error');
        loadThreads();
      });
  }
}

function deleteCompletedThreads() {
  const completedThreads = _cachedThreads.filter(
    t => t.status === 'done' || (t.count_video_upload > 0 && t.videos_uploaded >= t.count_video_upload)
  );

  if (completedThreads.length === 0) {
    showToast('Không có luồng nào đã hoàn thành để xóa', 'warning');
    return;
  }

  if (confirm(`Bạn có chắc chắn muốn xóa tất cả ${completedThreads.length} luồng đã hoàn thành không?`)) {
    showToast(`🗑️ Đang xóa ${completedThreads.length} luồng đã xong...`, 'info');

    const completedIds = completedThreads.map(t => t.id);

    // Optimistically remove completed rows from DOM immediately (0ms response)
    _cachedThreads = _cachedThreads.filter(t => !completedIds.includes(t.id));
    renderThreadTable();

    deleteThreadsBatch(completedIds)
      .then(() => {
        showToast('Các luồng đã xong được xóa thành công', 'success');
        loadThreads();
        loadUsers();
      })
      .catch((error) => {
        console.error('Error:', error);
        showToast('Lỗi khi xóa các luồng đã xong', 'error');
        loadThreads();
      });
  }
}

function rotateErrorProxies() {
  if (!confirm('Bạn có muốn đổi proxy mới cho tất cả các luồng đang bị lỗi kết nối hoặc getUploadInfo failed: Proxy? Proxy của tài khoản tương ứng cũng sẽ được đồng bộ đổi theo.')) {
    return;
  }

  showToast('Đang thực hiện đổi proxy...', 'info');

  fetch('/api/threads/rotate-error-proxies', {
    method: 'POST'
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast(data.message, 'success');
        loadThreads();
        if (typeof loadUsers === 'function') loadUsers();
      } else {
        showToast(data.error || 'Lỗi đổi proxy', 'error');
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      showToast('Lỗi kết nối máy chủ', 'error');
    });
}

function showThreadTasks(userId, username) {
  fetch(`/api/videos/tasks?userId=${userId}`)
    .then(r => r.json())
    .then(tasks => {
      const statusIcon = { pending: '⏳', uploading: '🔄', completed: '✅', failed: '❌' };
      const rows = tasks.map((t, i) => `
        <tr class="${t.status === 'failed' ? 'table-danger' : t.status === 'completed' ? 'table-success' : ''}">
          <td class="small">${i + 1}</td>
          <td class="small">${t.video_filename}</td>
          <td class="small" style="max-width:250px;word-break:break-all;" title="${(t.caption || '').replace(/"/g, '&quot;')}">${(t.caption || '-').substring(0, 60)}${(t.caption || '').length > 60 ? '...' : ''}</td>
          <td class="small">${t.products ? JSON.parse(typeof t.products === 'string' ? t.products : '[]').length : 0} SP</td>
          <td>${statusIcon[t.status] || ''} <small>${t.status}</small></td>
          <td class="small text-danger" style="max-width:200px;" title="${(t.error || '').replace(/"/g, '&quot;')}">${t.error ? t.error.substring(0, 50) + '...' : '-'}</td>
          <td class="small">${t.video_link ? `<a href="${t.video_link}" target="_blank">Link</a>` : '-'}</td>
        </tr>
      `).join('');

      const html = `
        <div class="modal fade" id="taskListModal" tabindex="-1">
          <div class="modal-dialog modal-xl">
            <div class="modal-content">
              <div class="modal-header">
                <h6 class="modal-title"><i class="bi bi-list-ul me-2"></i>Tasks: ${username} (${tasks.length} video)</h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body p-0">
                <div class="table-responsive" style="max-height:500px;">
                  <table class="table table-sm table-hover mb-0">
                    <thead class="table-light sticky-top">
                      <tr><th>#</th><th>Video</th><th>Caption</th><th>SP</th><th>Trạng thái</th><th>Lỗi</th><th>Link</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>`;

      // Remove old modal if exists
      document.getElementById('taskListModal')?.remove();
      document.body.insertAdjacentHTML('beforeend', html);
      new bootstrap.Modal(document.getElementById('taskListModal')).show();
    })
    .catch(() => showToast('Lỗi tải danh sách tasks', 'error'));
}

function scanVideoFolder() {
  const folderPath = document.getElementById('videoFolderInput')?.value?.trim();
  const info = document.getElementById('videoFolderInfo');
  if (!folderPath) { showToast('Nhập đường dẫn folder', 'warning'); return; }

  info.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang scan...';

  fetch('/api/videos/scan-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderPath })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        info.innerHTML = `<span class="badge bg-success">${data.videoCount} video</span> <span class="text-muted small">/ ${data.total} files trong folder</span>`;
      } else {
        info.innerHTML = `<span class="badge bg-danger">${data.error}</span>`;
      }
    })
    .catch(() => { info.innerHTML = '<span class="badge bg-danger">Lỗi kết nối</span>'; });
}

function scanCountryFolder(button) {
  const parentRow = button.closest('.country-import-row');
  const input = parentRow?.querySelector('.video-folder-input');
  const info = parentRow?.querySelector('.video-folder-info');
  const folderPath = input?.value?.trim();

  if (!folderPath) { showToast('Nhập đường dẫn folder', 'warning'); return; }

  if (info) {
    info.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang scan...';
  }

  fetch('/api/videos/scan-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderPath })
  })
    .then(r => r.json())
    .then(data => {
      if (info) {
        if (data.success) {
          info.innerHTML = `<span class="badge bg-success">${data.videoCount} video</span> <span class="text-muted small">/ ${data.total} files</span>`;
        } else {
          info.innerHTML = `<span class="badge bg-danger">${data.error}</span>`;
        }
      }
    })
    .catch(() => {
      if (info) {
        info.innerHTML = '<span class="badge bg-danger">Lỗi kết nối</span>';
      }
    });
}


function showImportExcelModal() {
  const modal = new bootstrap.Modal(
    document.getElementById('importVideoModal')
  );
  // Reset form + result
  const resultSection = document.getElementById('importResultSection');
  if (resultSection) resultSection.style.display = 'none';
  const form = document.getElementById('importExcelForm');
  if (form) form.reset();
  const btn = document.getElementById('importExcelSubmitBtn');
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-upload me-1"></i>Nhập & Tạo Luồng'; }
  const folderInfo = document.getElementById('videoFolderInfo');
  if (folderInfo) folderInfo.innerHTML = '';
  // Load delete-on-success setting
  fetch('/api/config/delete-video-on-success')
    .then(r => r.json())
    .then(data => {
      const cb = document.getElementById('deleteVideoOnSuccess');
      if (cb && data.success) cb.checked = data.enabled;
    })
    .catch(() => { });
  modal.show();
}

function retryFailedTasks() {
  fetch('/api/videos/tasks/retry', { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast(`Đã retry ${data.count} tasks lỗi`, 'success');
        updateTaskStats();
      } else {
        showToast(data.error || 'Lỗi retry', 'error');
      }
    })
    .catch(() => showToast('Lỗi kết nối', 'error'));
}

function removeAllTasks() {
  if (confirm('Xoá tất cả tasks? (không ảnh hưởng luồng)')) {
    fetch('/api/videos/tasks', { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast('Đã xoá tất cả tasks', 'success');
          updateTaskStats();
        }
      })
      .catch(() => showToast('Lỗi kết nối', 'error'));
  }
}

// Old blacklist/assignment functions removed — not needed for local upload
function _noop() { return; }
function loadImportBlacklist() { _noop(); }
function updateImportBlacklistCount() { _noop(); }
function saveImportBlacklist() { return Promise.resolve(); }
function loadUsersForAssignment() { return Promise.resolve([]); }
function renderFileAssignmentTable() { _noop(); }
function getFileAssignments() { return {}; }

function editThreadUserCookieForm(userId, username) {
  // Use querySelector to ensure the modal exists
  const modalElement = document.getElementById('editThreadUserCookieModal');

  if (!modalElement) {
    console.error('Modal element not found');
    return;
  }

  // Explicitly create the modal
  const modal = new bootstrap.Modal(modalElement, {
    backdrop: true,
    keyboard: true,
  });

  document.getElementById('editThreadUserIdInput').value = userId;
  document.getElementById('editThreadUsernameInput').value = username;
  document.getElementById('editThreadUserCookieInput').value = '';

  modal.show();
}

function updateRunningTimeAgain() {
  const runningTimeAgain = document.getElementById(
    'runningTimeAgainInput'
  ).value;

  fetch('/api/config/running-time-again', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ runningTimeAgain }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        showToast('Cập nhật thời gian chạy lại thành công', 'success');
      } else {
        showToast('Lỗi khi cập nhật thời gian', 'error');
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      showToast('Lỗi khi cập nhật thời gian', 'error');
    });
}

function removeAllVideos() {
  removeAllTasks();
}

function cleanupCompletedVideos() {
  if (!confirm('Xóa file video gốc của tất cả tasks đã post thành công?\n(Chỉ xóa file video trên máy, tasks lỗi giữ nguyên)')) return;
  fetch('/api/config/cleanup-completed-videos', { method: 'POST' })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast(`Đã xóa ${data.deleted} video thành công${data.errors > 0 ? `, ${data.errors} lỗi` : ''}`, data.errors > 0 ? 'warning' : 'success');
      } else {
        showToast(data.error || 'Lỗi cleanup', 'error');
      }
    })
    .catch(() => showToast('Lỗi kết nối', 'error'));
}

document.addEventListener('DOMContentLoaded', () => {
  // Load saved country import configurations
  loadImportConfig();

  // Save country import configurations on change
  document.querySelectorAll('.country-import-row input, #countryImportDelayMin, #countryImportDelayMax, #countryImportAutoStart, #countryImportDeleteOnSuccess').forEach(input => {
    input.addEventListener('change', saveCurrentImportConfig);
    if (input.type === 'text' || input.type === 'number') {
      input.addEventListener('keyup', saveCurrentImportConfig);
    }
  });

  // Load delete-on-success setting
  fetch('/api/config/delete-video-on-success')
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        const cbModal = document.getElementById('deleteVideoOnSuccess');
        if (cbModal) cbModal.checked = data.enabled;
        const cbPanel = document.getElementById('countryImportDeleteOnSuccess');
        if (cbPanel) cbPanel.checked = data.enabled;
      }
    })
    .catch(() => { });

  // Load AIGC setting and sync toggle
  fetch('/api/config/is-aigc')
    .then(r => r.json())
    .then(data => {
      const cb = document.getElementById('threadAigcSwitch');
      if (cb) cb.checked = (data.is_aigc !== false);
    })
    .catch(() => { });

  // Save AIGC when toggled in threads section
  document.getElementById('threadAigcSwitch')?.addEventListener('change', function () {
    const is_aigc = this.checked;
    fetch('/api/config/is-aigc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_aigc })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          showToast(is_aigc ? 'Đã BẬT gắn nhãn AIGC' : 'Đã TẮT gắn nhãn AIGC', 'success');
          // Sync with settings tab toggle if exists
          const settingsSwitch = document.getElementById('isAigcSwitch');
          if (settingsSwitch) settingsSwitch.checked = is_aigc;
        } else {
          showToast(data.message || 'Lỗi lưu AIGC', 'error');
          this.checked = !is_aigc;
        }
      })
      .catch(() => {
        showToast('Lỗi kết nối', 'error');
        this.checked = !is_aigc;
      });
  });

  // Auto select country when user is changed in thread modal
  document.getElementById('userSelectForThread')?.addEventListener('change', function () {
    const selectedOption = this.options[this.selectedIndex];
    const country = selectedOption.getAttribute('data-country');
    if (country) {
      document.getElementById('countrySelectForThread').value = country;
    }
  });

  // Create thread form submission
  document
    .getElementById('createThreadForm')
    .addEventListener('submit', function (event) {
      event.preventDefault();
      const userId = Number(
        document.getElementById('userSelectForThread').value
      );
      const delay_min = parseInt(document.getElementById('delayMinInput').value, 10);
      const delay_max = parseInt(document.getElementById('delayMaxInput').value, 10);
      const count_video_upload = parseInt(
        document.getElementById('countVideoUploadInput').value,
        10
      );
      const proxy =
        document.getElementById('proxyInputForThread').value || null;
      const caption =
        document.getElementById('captionInputForThread').value || null;
      const upload_mode = document.getElementById('uploadModeSelect').value;
      const auto_fill_products = document.getElementById('autoFillProductsCheckbox').checked;
      const country = document.getElementById('countrySelectForThread')?.value || 'vn';

      if (!userId) {
        showToast('Vui lòng chọn người dùng', 'error');
        return;
      }

      if (isNaN(delay_min) || delay_min < 10 || isNaN(delay_max) || delay_max < delay_min) {
        showToast('Thời gian chờ không hợp lệ (min >= 10, max >= min)', 'error');
        return;
      }

      if (isNaN(count_video_upload) || count_video_upload <= 0) {
        showToast('Số lượng video phải lớn hơn 0', 'error');
        return;
      }

      fetch('/api/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          delay_min,
          delay_max,
          proxy,
          count_video_upload,
          caption,
          upload_mode,
          auto_fill_products,
          country,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.error) {
            showToast(data.error, 'error');
            return;
          }
          loadUsers();
          loadThreads();
          const modal = bootstrap.Modal.getInstance(
            document.getElementById('createThreadModal')
          );
          modal.hide();
          showToast('Luồng được tạo thành công', 'success');
        })
        .catch((error) => {
          console.error('Error:', error);
          showToast('Lỗi khi tạo luồng', 'error');
        });
    });

  // Load threads when page loads
  loadThreads();

  // Import Excel form submission
  const importExcelForm = document.getElementById('importExcelForm');
  if (importExcelForm) {
    importExcelForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const formData = new FormData(this);
      const videoFolder = document.getElementById('videoFolderInput')?.value?.trim();
      if (!videoFolder) {
        showToast('Nhập đường dẫn folder video', 'warning');
        return;
      }
      // Drive link nếu không upload file
      const driveLink = document.getElementById('excelDriveLink')?.value?.trim() || '';
      const hasFile = document.getElementById('excelFileInput')?.files?.length > 0;
      if (!hasFile && !driveLink) {
        showToast('Chọn file Excel hoặc nhập link Google Drive', 'warning');
        return;
      }
      formData.append('videoFolder', videoFolder);
      formData.append('driveLink', driveLink);
      formData.append('delayMin', document.getElementById('excelDelayMin')?.value || '186');
      formData.append('delayMax', document.getElementById('excelDelayMax')?.value || '245');
      formData.append('country', document.getElementById('excelCountry')?.value || 'vn');
      formData.append('autoStart', document.getElementById('excelAutoStart')?.checked ? 'true' : 'false');

      // Save delete-on-success setting
      const deleteOnSuccess = document.getElementById('deleteVideoOnSuccess')?.checked || false;
      fetch('/api/config/delete-video-on-success', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: deleteOnSuccess })
      }).catch(() => { });

      const btn = document.getElementById('importExcelSubmitBtn');
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang xử lý...'; }

      fetch('/api/videos/import-excel', {
        method: 'POST',
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          const resultSection = document.getElementById('importResultSection');
          const resultContent = document.getElementById('importResultContent');
          if (resultSection && resultContent) {
            resultSection.style.display = '';

            if (data.success) {
              const s = data.summary;
              // Hiển thị column mapping để debug
              const colInfo = data.colMap ? Object.entries(data.colMap).map(([k, v]) => `${k}="${v}"`).join(', ') : '';

              let html = `
                <div class="alert ${data.imported > 0 ? 'alert-success' : 'alert-warning'} py-2 small mb-2">
                  <strong>Tasks:</strong> ${data.imported} OK
                  ${s.invalid > 0 ? ` | <span class="text-danger">Loại bỏ: ${s.invalid}</span>` : ''}
                  | Folder: ${s.videoFilesInFolder} video files
                  <br><strong>Sản phẩm:</strong> ${data.withProducts || 0} có SP | ${data.withoutProducts || 0} không SP
                </div>`;

              if (colInfo) {
                html += `<div class="small text-muted mb-2">Cột nhận diện: ${colInfo}</div>`;
              }

              if (data.threadsCreated > 0 || data.threadsExisted > 0) {
                html += `<div class="alert alert-info py-2 small mb-2">
                  <strong>Luồng:</strong> ${data.threadsCreated} tạo mới
                  ${data.threadsExisted > 0 ? ` | ${data.threadsExisted} đã tồn tại (auto-start)` : ''}
                  ${data.autoStarted ? ' | <span class="badge bg-success">Đang chạy</span>' : ' | <span class="badge bg-secondary">Chờ bắt đầu</span>'}
                </div>`;
              }

              if (data.invalid && data.invalid.length > 0) {
                html += `<details class="small mb-1"><summary class="text-danger fw-semibold">Chi tiết loại bỏ (${data.invalid.length})</summary>
                  <div style="max-height:150px;overflow-y:auto;" class="mt-1">
                  <table class="table table-sm table-bordered mb-0 small">
                    <thead class="table-light"><tr><th>Row</th><th>Account</th><th>Video</th><th>Lỗi</th></tr></thead>
                    <tbody>${data.invalid.map(r => `<tr class="table-danger"><td>${r.row}</td><td>${r.account}</td><td>${r.video}</td><td>${r.error}</td></tr>`).join('')}</tbody>
                  </table></div></details>`;
              }

              resultContent.innerHTML = html;
              if (data.imported > 0) {
                showToast(`Nhập ${data.imported} tasks, tạo ${data.threadsCreated} luồng${data.autoStarted ? ' — đang chạy' : ''}`, 'success');
                updateTaskStats();
                loadThreads();
                // Đóng modal sau 2 giây
                setTimeout(() => {
                  const modal = bootstrap.Modal.getInstance(document.getElementById('importVideoModal'));
                  if (modal) modal.hide();
                }, 2000);
                // Disable nút để tránh bấm lại
                if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Đã nhập xong'; }
              }
            } else {
              resultContent.innerHTML = `<div class="alert alert-danger py-2 small mb-0">${data.message}</div>`;
              showToast(data.message, 'error');
            }
          }
        })
        .catch(() => showToast('Lỗi kết nối', 'error'))
        .finally(() => {
          if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-upload me-1"></i>Nhập & Validate'; }
        });
    });
  }

  // Edit thread user cookie form submission
  document
    .getElementById('editThreadUserCookieForm')
    .addEventListener('submit', function (event) {
      event.preventDefault();

      const userId = document.getElementById('editThreadUserIdInput').value;
      const cookie = document
        .getElementById('editThreadUserCookieInput')
        .value.trim();

      if (!cookie) {
        showToast('Vui lòng nhập cookie', 'warning');
        return;
      }

      fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cookie }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            loadUsers();
            loadThreads();
            const modal = bootstrap.Modal.getInstance(
              document.getElementById('editThreadUserCookieModal')
            );
            modal.hide();
            showToast('Cập nhật cookie thành công', 'success');
          } else {
            showToast(data.message || 'Lỗi khi cập nhật cookie', 'error');
          }
        })
        .catch((error) => {
          console.error('Error:', error);
          showToast('Lỗi khi cập nhật cookie', 'error');
        });
    });

  // Load running time again
  fetch('/api/config/running-time-again')
    .then((response) => response.json())
    .then((data) => {
      if (data.runningTimeAgain) {
        document.getElementById('runningTimeAgainInput').value =
          data.runningTimeAgain;
      }
    })
    .catch((error) => {
      console.error('Error loading running time:', error);
    });
});

async function startCountryImport() {
  const btn = document.getElementById('btnCountryImport');
  const delayMin = document.getElementById('countryImportDelayMin')?.value || '186';
  const delayMax = document.getElementById('countryImportDelayMax')?.value || '245';
  const autoStart = document.getElementById('countryImportAutoStart')?.checked ? 'true' : 'false';
  const deleteOnSuccess = document.getElementById('countryImportDeleteOnSuccess')?.checked || false;

  // Gather active imports
  const activeImports = [];
  const rows = document.querySelectorAll('.country-import-row');
  
  rows.forEach(row => {
    let country = row.getAttribute('data-country');
    if (country === 'custom') {
      const customInput = row.querySelector('.custom-country-code-input');
      country = customInput?.value?.trim()?.toLowerCase() || '';
    }
    const videoFolder = row.querySelector('.video-folder-input')?.value?.trim();
    const driveLink = row.querySelector('.sheet-link-input')?.value?.trim();
    const maxVideosPerAccount = row.querySelector('.max-videos-input')?.value?.trim() || '0';
    const sheetName = row.querySelector('.sheet-name-input')?.value?.trim() || '';
    
    if (videoFolder && driveLink && country) {
      activeImports.push({
        country,
        videoFolder,
        driveLink,
        maxVideosPerAccount,
        sheetName,
        rowElement: row
      });
    }
  });

  if (activeImports.length === 0) {
    showToast('Vui lòng nhập đầy đủ Folder chứa Video và Link Google Sheet cho ít nhất 1 quốc gia!', 'warning');
    return;
  }

  // Save delete-on-success config
  try {
    await fetch('/api/config/delete-video-on-success', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: deleteOnSuccess })
    });
  } catch (e) {
    console.error('Lỗi khi lưu cấu hình xóa video:', e);
  }

  // Set loading state
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang xử lý...';
  }

  const results = [];
  
  // Run imports concurrently
  await Promise.all(activeImports.map(async (imp) => {
    const formData = new FormData();
    formData.append('videoFolder', imp.videoFolder);
    formData.append('driveLink', imp.driveLink);
    formData.append('delayMin', delayMin);
    formData.append('delayMax', delayMax);
    formData.append('country', imp.country);
    formData.append('autoStart', autoStart);
    formData.append('maxVideosPerAccount', imp.maxVideosPerAccount);
    if (imp.sheetName) {
      formData.append('sheetName', imp.sheetName);
    }

    try {
      const response = await fetch('/api/videos/import-excel', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      results.push({
        country: imp.country,
        success: data.success,
        imported: data.imported || 0,
        threadsCreated: data.threadsCreated || 0,
        threadsExisted: data.threadsExisted || 0,
        message: data.message || '',
        imp
      });
    } catch (err) {
      results.push({
        country: imp.country,
        success: false,
        message: 'Lỗi kết nối mạng',
        imp
      });
    }
  }));

  // Process results
  let successCount = 0;
  let summaryText = [];
  let errorText = [];

  results.forEach(res => {
    const countryName = res.country.toUpperCase();
    if (res.success) {
      successCount++;
      summaryText.push(`[${countryName}] ${res.imported} tasks (${res.threadsCreated} luồng mới, ${res.threadsExisted} luồng cũ)`);
    } else {
      errorText.push(`[${countryName}] Thất bại: ${res.message}`);
    }
  });

  // Re-enable button
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-plus-circle-fill me-1"></i>Thêm luồng chạy';
  }

  // Show summary notifications
  if (summaryText.length > 0) {
    showToast('Import thành công: ' + summaryText.join(', '), 'success');
    updateTaskStats();
    loadThreads();
  }
  
  if (errorText.length > 0) {
    showToast('Có lỗi xảy ra: ' + errorText.join('; '), 'error');
  }
}

function saveCurrentImportConfig() {
  const delayMin = document.getElementById('countryImportDelayMin')?.value || '186';
  const delayMax = document.getElementById('countryImportDelayMax')?.value || '245';
  const autoStart = document.getElementById('countryImportAutoStart')?.checked ?? true;
  const deleteOnSuccess = document.getElementById('countryImportDeleteOnSuccess')?.checked ?? true;

  const customCountryCode = document.querySelector('.custom-country-code-input')?.value?.trim() || '';

  const config = {
    customCountryCode,
    countries: {},
    general: {
      delayMin,
      delayMax,
      autoStart,
      deleteOnSuccess
    }
  };

  const rows = document.querySelectorAll('.country-import-row');
  rows.forEach(row => {
    const country = row.getAttribute('data-country');
    const videoFolder = row.querySelector('.video-folder-input')?.value || '';
    const driveLink = row.querySelector('.sheet-link-input')?.value || '';
    const sheetName = row.querySelector('.sheet-name-input')?.value || '';
    const maxVideosPerAccount = row.querySelector('.max-videos-input')?.value || '';
    const isAigc = row.querySelector('.aigc-switch') ? row.querySelector('.aigc-switch').checked : true;

    config.countries[country] = {
      videoFolder,
      driveLink,
      sheetName,
      maxVideosPerAccount,
      isAigc
    };
  });

  fetch('/api/videos/config/country-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  }).catch(e => console.error('Lỗi lưu cấu hình:', e));
}

let _isImportConfigLoaded = false;
function loadImportConfig(force = false) {
  // If already loaded and not forced, skip to avoid resetting user's active typing
  if (_isImportConfigLoaded && !force) return;

  const activeEl = document.activeElement;
  if (activeEl && (activeEl.matches('.video-folder-input, .sheet-link-input, .sheet-name-input, .max-videos-input, .custom-country-code-input'))) {
    return;
  }

  fetch('/api/videos/config/country-import')
    .then(r => r.json())
    .then(data => {
      if (data.success && data.config) {
        _isImportConfigLoaded = true;
        const cfg = data.config;
        
        // Populate general config
        if (cfg.general) {
          const delayMin = document.getElementById('countryImportDelayMin');
          const delayMax = document.getElementById('countryImportDelayMax');
          const autoStart = document.getElementById('countryImportAutoStart');
          const deleteOnSuccess = document.getElementById('countryImportDeleteOnSuccess');
          
          if (delayMin && cfg.general.delayMin !== undefined && document.activeElement !== delayMin) delayMin.value = cfg.general.delayMin;
          if (delayMax && cfg.general.delayMax !== undefined && document.activeElement !== delayMax) delayMax.value = cfg.general.delayMax;
          if (autoStart && cfg.general.autoStart !== undefined) autoStart.checked = !!cfg.general.autoStart;
          if (deleteOnSuccess && cfg.general.deleteOnSuccess !== undefined) deleteOnSuccess.checked = !!cfg.general.deleteOnSuccess;
        }

        // Populate custom country code
        if (cfg.customCountryCode !== undefined) {
          const customInput = document.querySelector('.custom-country-code-input');
          if (customInput && document.activeElement !== customInput) customInput.value = cfg.customCountryCode;
        }

        // Populate countries config
        if (cfg.countries) {
          const rows = document.querySelectorAll('.country-import-row');
          rows.forEach(row => {
            const country = row.getAttribute('data-country');
            const countryCfg = cfg.countries[country];
            if (countryCfg) {
              const folderInput = row.querySelector('.video-folder-input');
              const linkInput = row.querySelector('.sheet-link-input');
              const sheetNameInput = row.querySelector('.sheet-name-input');
              const maxInput = row.querySelector('.max-videos-input');
              const aigcSwitch = row.querySelector('.aigc-switch');
              
              if (folderInput && countryCfg.videoFolder !== undefined && document.activeElement !== folderInput) folderInput.value = countryCfg.videoFolder;
              if (linkInput && countryCfg.driveLink !== undefined && document.activeElement !== linkInput) linkInput.value = countryCfg.driveLink;
              if (sheetNameInput && countryCfg.sheetName !== undefined && document.activeElement !== sheetNameInput) sheetNameInput.value = countryCfg.sheetName;
              if (maxInput && countryCfg.maxVideosPerAccount !== undefined && document.activeElement !== maxInput) maxInput.value = countryCfg.maxVideosPerAccount;
              if (aigcSwitch && countryCfg.isAigc !== undefined) aigcSwitch.checked = !!countryCfg.isAigc;
            }
          });
        }
      }
    })
    .catch(e => console.error('Lỗi load cấu hình:', e));
}

// Attach auto-save listener to inputs
let _autoSaveTimer = null;
function initAutoSaveImportConfig() {
  const container = document.getElementById('threads-content') || document;
  container.addEventListener('input', (e) => {
    if (e.target.matches('.video-folder-input, .sheet-link-input, .sheet-name-input, .max-videos-input, .custom-country-code-input, #countryImportDelayMin, #countryImportDelayMax')) {
      clearTimeout(_autoSaveTimer);
      _autoSaveTimer = setTimeout(saveCurrentImportConfig, 1500);
    }
  });

  container.addEventListener('change', (e) => {
    if (e.target.matches('.aigc-switch, #countryImportAutoStart, #countryImportDeleteOnSuccess, .video-folder-input, .sheet-link-input, .sheet-name-input, .max-videos-input, .custom-country-code-input')) {
      saveCurrentImportConfig();
    }
  });
}

// Load import config and threads immediately on page initialization
document.addEventListener('DOMContentLoaded', () => {
  loadImportConfig(true);
  initAutoSaveImportConfig();
  if (typeof loadThreads === 'function') {
    loadThreads();
  }
});

async function startSingleCountryImport(country, btn) {
  const row = btn.closest('.country-import-row');
  if (!row) return;

  const videoFolder = row.querySelector('.video-folder-input')?.value?.trim();
  const driveLink = row.querySelector('.sheet-link-input')?.value?.trim();
  const sheetName = row.querySelector('.sheet-name-input')?.value?.trim() || '';
  const maxVideosPerAccount = row.querySelector('.max-videos-input')?.value?.trim() || '0';

  if (!videoFolder || !driveLink) {
    showToast('Vui lòng nhập đầy đủ Folder chứa Video và Link Google Sheet cho quốc gia này!', 'warning');
    return;
  }

  const delayMin = document.getElementById('countryImportDelayMin')?.value || '186';
  const delayMax = document.getElementById('countryImportDelayMax')?.value || '245';
  const autoStart = document.getElementById('countryImportAutoStart')?.checked ? 'true' : 'false';
  const deleteOnSuccess = document.getElementById('countryImportDeleteOnSuccess')?.checked || false;

  // Save current configurations first
  saveCurrentImportConfig();

  // Save delete-on-success config
  try {
    await fetch('/api/config/delete-video-on-success', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: deleteOnSuccess })
    });
  } catch (e) {
    console.error('Lỗi khi lưu cấu hình xóa video:', e);
  }

  // Set loading state
  btn.disabled = true;
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang xử lý...';

  const aigcSwitch = row.querySelector('.aigc-switch');
  const isAigc = aigcSwitch ? aigcSwitch.checked : true;

  const formData = new FormData();
  formData.append('videoFolder', videoFolder);
  formData.append('driveLink', driveLink);
  formData.append('delayMin', delayMin);
  formData.append('delayMax', delayMax);
  formData.append('country', country);
  formData.append('autoStart', autoStart);
  formData.append('maxVideosPerAccount', maxVideosPerAccount);
  formData.append('isAigc', isAigc);
  if (sheetName) {
    formData.append('sheetName', sheetName);
  }

  try {
    const response = await fetch('/api/videos/import-excel', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (data.success) {
      showToast(`[${country.toUpperCase()}] Import thành công ${data.imported} tasks (${data.threadsCreated} luồng mới, ${data.threadsExisted} luồng cũ)`, 'success');
      
      updateTaskStats();
      loadThreads();
    } else {
      showToast(`[${country.toUpperCase()}] Thất bại: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`[${country.toUpperCase()}] Lỗi kết nối mạng`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

function startSingleCountryImportCustom(btn) {
  const row = btn.closest('.country-import-row');
  if (!row) return;
  const countryInput = row.querySelector('.custom-country-code-input');
  const country = countryInput?.value?.trim()?.toLowerCase();
  if (!country) {
    showToast('Vui lòng nhập mã quốc gia (ví dụ: th, my, sg, br, phss...)', 'warning');
    countryInput?.focus();
    return;
  }
  startSingleCountryImport(country, btn);
}

// === Nút Chìa Khóa (🔑): Bấm lần 1 bật GemLogin Profile lên để thao tác bằng tay -> Bấm lần 2 (hoặc đóng trình duyệt) tự lưu Cookie ===
async function recoverSingleThreadCookie(threadId, btn) {
  const originalHtml = btn ? btn.innerHTML : '<i class="bi bi-key-fill"></i>';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;"></span>';
  }

  try {
    const res = await fetch(`/api/threads/${threadId}/recover-cookie`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interactive: true, autoStart: true })
    });
    const data = await res.json();
    if (data.success && data.openedOnly) {
      showToast(`🖐️ ${data.message}`, 'info');
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('btn-outline-warning');
        btn.classList.add('btn-success');
        btn.title = 'Trình duyệt đang mở — Bấm lại vào đây (hoặc đóng trình duyệt) sau khi thao tác xong để lưu Cookie!';
        btn.innerHTML = '<i class="bi bi-check2-circle"></i> Lưu';
      }
      return;
    } else if (data.success) {
      showToast(`✅ ${data.message || `[${data.username}] Đã lưu Cookie mới qua ${data.method} & tự chạy lại!`}`, 'success');
      loadThreads();
      if (typeof loadUsers === 'function') loadUsers();
    } else {
      showToast(`❌ [${data.username || '#' + threadId}] ${data.error || 'Không thể mở/lấy Cookie'}`, 'error');
    }
  } catch (err) {
    showToast(`❌ Lỗi kết nối khi thao tác GemLogin cho luồng #${threadId}`, 'error');
  }
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function recoverDeadCookies(btn) {
  const selectedIds = Array.from(document.querySelectorAll('.thread-checkbox:checked'))
    .map(cb => parseInt(cb.dataset.threadId, 10))
    .filter(id => !isNaN(id));

  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang lấy Cookie...';
  }

  if (selectedIds.length > 0) {
    showToast(`🔑 Đang khôi phục Cookie cho ${selectedIds.length} luồng đã chọn...`, 'info');
  } else {
    showToast('🔑 Đang quét và khôi phục toàn bộ luồng bị lỗi Cookie qua Silent Refresh & GemLogin...', 'info');
  }

  try {
    const res = await fetch('/api/threads/recover-dead-cookies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadIds: selectedIds,
        forceGemLogin: false
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ ${data.message}`, data.recovered > 0 ? 'success' : 'info');
      loadThreads();
      if (typeof loadUsers === 'function') loadUsers();
    } else {
      showToast(`❌ ${data.error || 'Lỗi khôi phục Cookie hàng loạt'}`, 'error');
    }
  } catch (err) {
    showToast('❌ Lỗi kết nối khi khôi phục Cookie hàng loạt', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}


