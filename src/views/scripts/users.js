// === User proxy inline edit ===
function toggleEditUserProxy(userId, currentProxy) {
  document.getElementById('proxyUserDisplay_' + userId).classList.add('d-none');
  document.getElementById('proxyUserEdit_' + userId).classList.remove('d-none');
  document.getElementById('proxyUserInput_' + userId).value = currentProxy || '';
  document.getElementById('proxyUserInput_' + userId).focus();
}
function cancelEditUserProxy(userId) {
  document.getElementById('proxyUserDisplay_' + userId).classList.remove('d-none');
  document.getElementById('proxyUserEdit_' + userId).classList.add('d-none');
}
function saveUserProxy(userId) {
  const proxy = document.getElementById('proxyUserInput_' + userId).value.trim();
  fetch(`/api/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proxy }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('Cập nhật proxy thành công', 'success');
        loadUsers();
      } else {
        showToast(data.message || 'Lỗi', 'error');
      }
    })
    .catch(() => showToast('Lỗi kết nối', 'error'));
}

function saveUserCountry(userId, country, selectEl) {
  fetch(`/api/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('Cập nhật quốc gia thành công', 'success');
        if (selectEl) {
          const row = selectEl.closest('tr.user-row');
          if (row) {
            row.dataset.country = country;
            filterUsers();
          }
        } else {
          loadUsers();
        }
      } else {
        showToast(data.message || 'Lỗi', 'error');
      }
    })
    .catch(() => showToast('Lỗi kết nối', 'error'));
}

function filterUsers() {
  const searchInput = document.getElementById('userSearchInput');
  const countryFilter = document.getElementById('userCountryFilter');
  const mcnFilter = document.getElementById('userMcnFilter');
  const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
  const selectedCountry = countryFilter ? countryFilter.value : 'all';
  const selectedMcn = mcnFilter ? mcnFilter.value : 'all';

  const rows = document.querySelectorAll('#userTableBody tr.user-row');
  let visibleCount = 0;

  rows.forEach((row) => {
    const country = (row.dataset.country || 'vn').toLowerCase();
    const mcnState = (row.dataset.mcnState || 'unchecked').toLowerCase();
    const username = (row.dataset.username || '').toLowerCase();
    const proxy = (row.dataset.proxy || '').toLowerCase();
    const cookie = (row.querySelector('input[readonly]')?.value || '').toLowerCase();

    const matchCountry = selectedCountry === 'all' || country === selectedCountry;
    const matchMcn =
      selectedMcn === 'all' ||
      (selectedMcn === 'expiring' && mcnState === 'expiring') ||
      (selectedMcn === 'active' && (mcnState === 'active' || mcnState === 'expiring')) ||
      (selectedMcn === 'none' && (mcnState === 'none' || mcnState === 'unchecked'));
    const matchQuery = !query || username.includes(query) || proxy.includes(query) || cookie.includes(query);

    if (matchCountry && matchMcn && matchQuery) {
      row.classList.remove('d-none');
      visibleCount++;
      const indexCell = row.querySelector('.user-index');
      if (indexCell) indexCell.textContent = visibleCount;
    } else {
      row.classList.add('d-none');
    }
  });

  const summaryBadge = document.getElementById('userCountSummary');
  if (summaryBadge) {
    if (selectedCountry === 'all' && selectedMcn === 'all' && !query) {
      summaryBadge.textContent = `Tổng: ${rows.length} tài khoản`;
    } else {
      summaryBadge.textContent = `Hiển thị: ${visibleCount} / ${rows.length} tài khoản`;
    }
  }
}

function toggleUserActive(userId, isActive, username) {
  fetch(`/api/users/${userId}/active`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: isActive }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const msg = isActive
          ? `Đã kích hoạt tài khoản ${username || ''}`
          : `Đã TẮT kích hoạt tài khoản ${username || ''}`;
        showToast(msg, isActive ? 'success' : 'warning');
      } else {
        showToast(data.message || 'Lỗi cập nhật trạng thái kích hoạt', 'error');
      }
    })
    .catch(() => showToast('Lỗi kết nối khi cập nhật trạng thái', 'error'));
}

function exportUsersJson() {
  const a = document.createElement('a');
  a.href = '/api/users/export-json';
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Đang tải file JSON...', 'success');
}

const EXPORT_USERNAME_COUNTRY_LABELS = {
  all: '🌍 Xuất tất cả quốc gia',
  vn: '🇻🇳 Việt Nam (vn)',
  ph: '🇵🇭 Philippines (ph)',
  id: '🇮🇩 Indonesia (id)',
  my: '🇲🇾 Malaysia (my)',
  th: '🇹🇭 Thái Lan (th)',
  sg: '🇸🇬 Singapore (sg)',
  br: '🇧🇷 Brazil (br)',
  ar: '🇦🇷 Argentina (ar)',
  mx: '🇲🇽 México (mx)',
  tw: '🇹🇼 Đài Loan (tw)',
};

function getExportUsernamesList(countryFilter = 'all', activeFilter = 'all') {
  const rows = document.querySelectorAll('#userTableBody tr.user-row');
  const usernames = [];
  rows.forEach((row) => {
    const country = (row.dataset.country || 'vn').toLowerCase();
    const activeSwitch = row.querySelector('.user-active-switch');
    const isActive = activeSwitch ? activeSwitch.checked : true;
    if (countryFilter !== 'all' && country !== countryFilter) return;
    if (activeFilter === 'active' && !isActive) return;

    const rawName = (
      row.dataset.usernameRaw ||
      row.querySelector('td:nth-child(3) strong')?.textContent ||
      ''
    ).trim();
    if (rawName) usernames.push(rawName);
  });
  return usernames;
}

function showExportUsernamesModal() {
  const countrySelect = document.getElementById('exportUsernameCountry');
  if (countrySelect) {
    const counts = { all: 0 };
    document.querySelectorAll('#userTableBody tr.user-row').forEach((row) => {
      const c = (row.dataset.country || 'vn').toLowerCase();
      counts.all++;
      counts[c] = (counts[c] || 0) + 1;
    });

    const pageCountryFilter = document.getElementById('userCountryFilter');
    const prevValue = pageCountryFilter ? pageCountryFilter.value : 'all';

    // Giữ đầy đủ danh sách quốc gia + bổ sung nếu DB có mã quốc gia khác
    const knownCodes = Object.keys(EXPORT_USERNAME_COUNTRY_LABELS);
    const extraCodes = Object.keys(counts).filter((c) => !knownCodes.includes(c));
    const orderedCodes = [...knownCodes, ...extraCodes];

    countrySelect.innerHTML = '';
    orderedCodes.forEach((code) => {
      const cnt = counts[code] || 0;
      if (code !== 'all' && cnt === 0 && !knownCodes.includes(code)) return;
      const opt = document.createElement('option');
      opt.value = code;
      const baseLabel = EXPORT_USERNAME_COUNTRY_LABELS[code] || code.toUpperCase();
      opt.textContent = `${baseLabel} (${cnt})`;
      countrySelect.appendChild(opt);
    });

    countrySelect.value = orderedCodes.includes(prevValue) ? prevValue : 'all';
  }

  updateExportUsernamesPreview();
  const modalEl = document.getElementById('exportUsernamesModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

function updateExportUsernamesPreview() {
  const countryEl = document.getElementById('exportUsernameCountry');
  const activeRadio = document.querySelector('input[name="exportUsernameActive"]:checked');
  const previewEl = document.getElementById('exportUsernamePreview');
  const badgeEl = document.getElementById('exportUsernameCountBadge');
  const copyBtn = document.getElementById('btnCopyExportUsernames');
  const dlBtn = document.getElementById('btnDownloadExportUsernames');

  const country = countryEl ? countryEl.value : 'all';
  const activeScope = activeRadio ? activeRadio.value : 'active';
  const list = getExportUsernamesList(country, activeScope);

  if (badgeEl) {
    badgeEl.textContent = `${list.length} tài khoản`;
    badgeEl.className = list.length > 0 ? 'badge bg-primary' : 'badge bg-secondary';
  }
  if (previewEl) {
    previewEl.value = list.join('\n');
  }
  if (copyBtn) copyBtn.disabled = list.length === 0;
  if (dlBtn) dlBtn.disabled = list.length === 0;
}

function copyExportedUsernames() {
  const previewEl = document.getElementById('exportUsernamePreview');
  const text = previewEl ? previewEl.value : '';
  if (!text) {
    showToast('Không có username nào để copy', 'warning');
    return;
  }
  const count = text.split('\n').length;
  const fallbackCopy = () => {
    previewEl.focus();
    previewEl.select();
    document.execCommand('copy');
    showToast(`Đã copy ${count} username vào clipboard`, 'success');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast(`Đã copy ${count} username vào clipboard`, 'success'))
      .catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
}

function downloadExportedUsernames() {
  const countryEl = document.getElementById('exportUsernameCountry');
  const activeRadio = document.querySelector('input[name="exportUsernameActive"]:checked');
  const country = countryEl ? countryEl.value : 'all';
  const activeScope = activeRadio ? activeRadio.value : 'active';
  const list = getExportUsernamesList(country, activeScope);

  if (list.length === 0) {
    showToast('Không có username nào để xuất', 'warning');
    return;
  }

  const content = list.join('\r\n') + '\r\n';
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const suffixActive = activeScope === 'active' ? 'kich_hoat' : 'tat_ca';
  a.href = url;
  a.download = `usernames_${country}_${suffixActive}_${list.length}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`Đã xuất ${list.length} username ra file .txt`, 'success');
}

function showImportJsonModal() {
  const modal = new bootstrap.Modal(document.getElementById('importJsonModal'));
  modal.show();
}

function showAddModal() {
  const modal = new bootstrap.Modal(document.getElementById('addModal'));
  modal.show();
}

function editUser(id, username, cookie, proxy, country) {
  const modal = new bootstrap.Modal(document.getElementById('editModal'));
  document.getElementById('editForm').action = `/users/${id}`;
  document.getElementById('editUsername').value = username;
  document.getElementById('editCookie').value = cookie;
  document.getElementById('editProxy').value = proxy || '';
  document.getElementById('editCountry').value = country || 'vn';
  modal.show();
}

function showImportModal() {
  const modal = new bootstrap.Modal(document.getElementById('importModal'));
  modal.show();
}

function showBulkThreadModal() {
  const selectedUsers = document.querySelectorAll('.user-checkbox:checked');
  if (selectedUsers.length === 0) {
    showToast('Vui lòng chọn ít nhất một người dùng', 'warning');
    return;
  }
  const modal = new bootstrap.Modal(document.getElementById('bulkThreadModal'));
  modal.show();
}

function toggleAllUsers(checkbox) {
  const userCheckboxes = document.querySelectorAll(
    '#userTableBody tr.user-row:not(.d-none) .user-checkbox:not(:disabled)'
  );
  userCheckboxes.forEach((box) => {
    box.checked = checkbox.checked;
  });
}

function deleteSelectedUsers() {
  const selectedCheckboxes = document.querySelectorAll(
    '#userTableBody tr.user-row:not(.d-none) .user-checkbox:checked'
  );
  if (selectedCheckboxes.length === 0) {
    showToast('Vui lòng chọn ít nhất một người dùng để xóa', 'warning');
    return;
  }

  const userIds = Array.from(selectedCheckboxes).map((box) => box.dataset.userId);

  if (
    !confirm(
      `Bạn có chắc chắn muốn xóa ${userIds.length} người dùng đã chọn? Thao tác này không thể hoàn tác!`
    )
  ) {
    return;
  }

  fetch('/api/users/delete-batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ userIds }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        loadUsers();
        loadThreads();
        const selectAll = document.getElementById('selectAllUsers');
        if (selectAll) selectAll.checked = false;
        showToast(data.message || 'Đã xóa người dùng thành công', 'success');
      } else {
        showToast(data.message || 'Xóa người dùng thất bại', 'error');
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      showToast('Lỗi kết nối khi xóa người dùng', 'error');
    });
}

function deleteAllUsers() {
  const totalRows = document.querySelectorAll('#userTableBody tr.user-row').length;
  if (totalRows === 0) {
    showToast('Danh sách người dùng hiện đang trống', 'info');
    return;
  }

  if (
    !confirm(
      `CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ (${totalRows}) tài khoản người dùng không? Thao tác này sẽ xóa sạch tài khoản và các luồng/nhiệm vụ liên quan!`
    )
  ) {
    return;
  }

  fetch('/api/users/delete-all', {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        loadUsers();
        loadThreads();
        const selectAll = document.getElementById('selectAllUsers');
        if (selectAll) selectAll.checked = false;
        showToast(data.message || 'Đã xóa toàn bộ người dùng', 'success');
      } else {
        showToast(data.message || 'Lỗi khi xóa người dùng', 'error');
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      showToast('Lỗi kết nối khi xóa toàn bộ người dùng', 'error');
    });
}

function confirmDeleteUser(userId) {
  if (confirm('Bạn có chắc chắn muốn xóa người dùng này không?')) {
    fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Phản hồi mạng không thành công');
        }
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          loadUsers();
          loadThreads();
          showToast('Xóa người dùng thành công', 'success');
        } else {
          showToast(data.message || 'Xóa người dùng không thành công', 'error');
        }
      })
      .catch((error) => {
        console.error('Error:', error);
        showToast('Lỗi khi xóa người dùng', 'error');
      });
  }
  return false;
}

function loadUsers() {
  fetch('/')
    .then((response) => response.text())
    .then((html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const userTableBody = document.getElementById('userTableBody') || document.querySelector('table tbody');
      const newUserTableBody = doc.getElementById('userTableBody') || doc.querySelector('table tbody');
      if (userTableBody && newUserTableBody) {
        userTableBody.innerHTML = newUserTableBody.innerHTML;
      }

      // Update the user select dropdown in the thread creation modal
      const userSelect = document.getElementById('userSelectForThread');
      const newUserSelect = doc.getElementById('userSelectForThread');
      if (userSelect && newUserSelect) {
        userSelect.innerHTML = newUserSelect.innerHTML;
      }

      // Re-attach event listeners and update delete buttons
      updateUserTableDeleteButtons();
      filterUsers();
    })
    .catch((error) => {
      console.error('Error:', error);
      showToast('Tải lại danh sách người dùng không thành công', 'error');
    });
}

function updateUserTableDeleteButtons() {
  const deleteButtons = document.querySelectorAll(
    'form[action^="/users/"][action$="/delete"]'
  );
  deleteButtons.forEach((form) => {
    const userId = form.action.split('/')[2];
    form.removeAttribute('onsubmit');
    form
      .querySelector('button')
      .setAttribute('onclick', `confirmDeleteUser(${userId})`);
  });
}

// Event Listeners for User Management
document.addEventListener('DOMContentLoaded', () => {
  // Add user form submission
  document
    .querySelector('form[action="/users"]')
    .addEventListener('submit', function (event) {
      event.preventDefault();
      const formData = new FormData(this);

      fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: formData.get('username'),
          cookie: formData.get('cookie'),
          proxy: formData.get('proxy') || '',
          country: formData.get('country') || 'vn',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            loadUsers();
            showToast(data.message, 'success');
            const modal = bootstrap.Modal.getInstance(
              document.getElementById('addModal')
            );
            modal.hide();
          } else {
            showToast(data.message, 'error');
          }
        })
        .catch((error) => {
          console.error('Error:', error);
          showToast('Đã xảy ra lỗi', 'error');
        });
    });

  // Edit user form submission
  document
    .getElementById('editForm')
    .addEventListener('submit', function (event) {
      event.preventDefault();
      const userId = this.action.split('/').pop();
      const formData = new FormData(this);

      fetch(`/api/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({
          username: formData.get('username'),
          cookie: formData.get('cookie'),
          proxy: formData.get('proxy') || '',
          country: formData.get('country') || 'vn',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            loadUsers();
            showToast(data.message, 'success');
            const modal = bootstrap.Modal.getInstance(
              document.getElementById('editModal')
            );
            modal.hide();
          } else {
            showToast(data.message, 'error');
          }
        })
        .catch((error) => {
          console.error('Error:', error);
          showToast('Đã xảy ra lỗi', 'error');
        });
    });

  // Import users form submission
  document
    .getElementById('importForm')
    .addEventListener('submit', function (event) {
      event.preventDefault();

      const formData = new FormData(this);

      fetch('/api/users/import-txt', {
        method: 'POST',
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            showToast(
              `Đã cập nhật ${data.results.skipped} người dùng, thêm mới ${data.results.successful}`,
              'success'
            );
            loadUsers();
            const modal = bootstrap.Modal.getInstance(
              document.getElementById('importModal')
            );
            modal.hide();
          } else {
            showToast(data.message, 'error');
          }
        })
        .catch((error) => {
          console.error('Error:', error);
          showToast('Đã xảy ra lỗi trong quá trình nhập', 'error');
        });
    });

  // Bulk thread creation
  document
    .getElementById('bulkThreadForm')
    .addEventListener('submit', async function (event) {
      event.preventDefault();

      const selectedUsers = Array.from(
        document.querySelectorAll('.user-checkbox:checked')
      ).map((checkbox) => checkbox.dataset.userId);

      const delay_min = parseInt(document.getElementById('bulkDelayMin').value) || 186;
      const delay_max = parseInt(document.getElementById('bulkDelayMax').value) || 245;
      const count_video_upload = parseInt(
        document.getElementById('bulkVideoCount').value
      );
      const proxy = document.getElementById('bulkProxy').value || null;
      const upload_mode = document.getElementById('bulkUploadMode').value;
      const auto_fill_products = document.getElementById('bulkAutoFillProducts').checked;
      const country = document.getElementById('bulkCountry')?.value || 'vn';

      try {
        const promises = selectedUsers.map((userId) =>
          fetch('/api/threads', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: Number(userId),
              delay_min,
              delay_max,
              proxy,
              count_video_upload,
              upload_mode,
              auto_fill_products,
              country,
            }),
          })
        );

        await Promise.all(promises);

        loadUsers();
        loadThreads();
        const modal = bootstrap.Modal.getInstance(
          document.getElementById('bulkThreadModal')
        );
        modal.hide();
        showToast('Tạo luồng hàng loạt thành công', 'success');
      } catch (error) {
        console.error('Error:', error);
        showToast('Lỗi khi tạo luồng hàng loạt', 'error');
      }
    });

  // Import JSON form
  document.getElementById('importJsonForm')?.addEventListener('submit', function (event) {
    event.preventDefault();
    const formData = new FormData(this);

    fetch('/api/users/import-json', { method: 'POST', body: formData })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast(data.message, 'success');
          loadUsers();
          bootstrap.Modal.getInstance(document.getElementById('importJsonModal'))?.hide();
        } else {
          showToast(data.message || 'Lỗi nhập JSON', 'error');
        }
      })
      .catch(() => showToast('Lỗi nhập JSON', 'error'));
  });

  // Initialize delete button event listeners
  updateUserTableDeleteButtons();
});

function assignRandomProxies() {
  const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
  if (selectedCheckboxes.length === 0) {
    showToast('Vui lòng chọn ít nhất một người dùng', 'warning');
    return;
  }
  const userIds = Array.from(selectedCheckboxes).map(box => box.dataset.userId);

  fetch('/api/users/assign-random-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast(data.message || 'Chèn proxy ngẫu nhiên thành công', 'success');
        loadUsers();
      } else {
        showToast(data.error || 'Lỗi chèn proxy', 'error');
      }
    })
    .catch(() => showToast('Lỗi kết nối', 'error'));
}

function loginShopee(userId) {
  showToast('Đang khởi động trình duyệt Chrome để đăng nhập...', 'info');
  fetch('/api/users/login-shopee', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast(data.message, 'success');
        loadUsers();
      } else {
        showToast(data.error || 'Đăng nhập không thành công', 'error');
      }
    })
    .catch(err => {
      console.error(err);
      showToast('Lỗi kết nối đến máy chủ', 'error');
    });
}

async function recoverSingleUserCookie(userId, btn) {
  const originalHtml = btn ? btn.innerHTML : '<i class="bi bi-key-fill"></i>';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span>';
  }

  try {
    const res = await fetch(`/api/users/${userId}/recover-cookie`, {
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
      const cookieInput = document.getElementById('userCookieInput_' + userId);
      if (cookieInput && data.cookie) {
        cookieInput.value = data.cookie;
      }
      showToast(`✅ ${data.message || `[${data.username}] Đã lưu Cookie mới qua ${data.method}!`}`, 'success');
      loadUsers();
      if (typeof loadThreads === 'function') loadThreads();
    } else {
      showToast(`❌ [${data.username || '#' + userId}] ${data.error || 'Không thể mở/lấy Cookie'}`, 'error');
    }
  } catch (err) {
    showToast(`❌ Lỗi kết nối khi thao tác GemLogin cho tài khoản #${userId}`, 'error');
  }
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function recoverUsersCookiesFromGemLogin(btn) {
  const selectedIds = Array.from(
    document.querySelectorAll('#userTableBody tr.user-row:not(.d-none) .user-checkbox:checked')
  )
    .map(cb => parseInt(cb.dataset.userId, 10))
    .filter(id => !isNaN(id));

  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang lấy Cookie...';
  }

  if (selectedIds.length > 0) {
    showToast(`🔑 Đang lấy lại Cookie từ GemLogin cho ${selectedIds.length} tài khoản đã chọn...`, 'info');
  } else {
    showToast('🔑 Đang quét và lấy lại Cookie từ GemLogin cho các tài khoản lỗi Cookie...', 'info');
  }

  try {
    const res = await fetch('/api/users/recover-cookies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIds: selectedIds,
        forceGemLogin: false
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ ${data.message}`, data.recovered > 0 ? 'success' : 'info');
      loadUsers();
      if (typeof loadThreads === 'function') loadThreads();
    } else {
      showToast(`❌ ${data.error || 'Lỗi khi lấy Cookie hàng loạt'}`, 'error');
    }
  } catch (err) {
    showToast('❌ Lỗi kết nối khi lấy Cookie hàng loạt', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// === Kiểm tra hạn MCN cho từng tài khoản & hàng loạt ===
function formatMcnDateVN(endAtSec) {
  if (!endAtSec || Number(endAtSec) <= 0) return '';
  const d = new Date(Number(endAtSec) * 1000 + 7 * 3600 * 1000);
  return (
    String(d.getUTCDate()).padStart(2, '0') +
    '/' +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    '/' +
    d.getUTCFullYear()
  );
}

function updateUserMcnRowUI(item) {
  if (!item || !item.id) return;
  const cell = document.getElementById('userMcnCell_' + item.id);
  const row = document.querySelector(`#userTableBody tr.user-row[data-user-id="${item.id}"]`);
  if (!cell) return;

  const endAt = item.mcn_end_at ? Number(item.mcn_end_at) : 0;
  const daysLeft = endAt > 0 ? Math.floor((endAt * 1000 - Date.now()) / 86400000) : null;
  const isExpiring = daysLeft !== null && daysLeft < 7;
  const mcnState = isExpiring
    ? 'expiring'
    : endAt > 0
      ? 'active'
      : item.mcn_status === 'none'
        ? 'none'
        : 'unchecked';

  if (row) {
    row.dataset.mcnState = mcnState;
    row.classList.toggle('mcn-expiring-row', isExpiring);
  }

  let bodyHtml = '';
  if (endAt > 0) {
    const dateStr = formatMcnDateVN(endAt);
    const label = daysLeft <= 0 ? 'Hết hạn' : `Còn ${daysLeft} ngày`;
    bodyHtml = `
      <div class="${isExpiring ? 'mcn-date-expiring' : 'fw-semibold text-dark'}">${dateStr}</div>
      <span class="${isExpiring ? 'mcn-badge-expiring' : 'mcn-badge-ok'}">${label}</span>
    `;
    cell.title = item.mcn_name ? `MCN: ${item.mcn_name}` : 'Hạn MCN';
  } else if (item.mcn_status === 'none') {
    bodyHtml = '<span class="text-muted small">-</span>';
    cell.title = 'Không gắn MCN';
  } else {
    bodyHtml = '<span class="text-warning small">Lỗi KT</span>';
    cell.title = item.error ? `Lỗi: ${item.error}` : 'Lỗi kiểm tra hạn MCN';
  }

  cell.innerHTML = `
    <div class="d-flex align-items-center justify-content-between gap-1">
      <div>${bodyHtml}</div>
      <button type="button" class="mcn-refresh-btn" onclick="checkSingleUserMcn('${item.id}', this)" title="Kiểm tra hạn MCN">
        <i class="bi bi-arrow-clockwise"></i>
      </button>
    </div>
  `;
}

async function checkSingleUserMcn(userId, btn) {
  const originalHtml = btn ? btn.innerHTML : '<i class="bi bi-arrow-clockwise"></i>';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" style="width:11px;height:11px;"></span>';
  }
  try {
    const res = await fetch(`/api/users/${userId}/check-mcn`, { method: 'POST' });
    const json = await res.json();
    if (json.success && json.data) {
      updateUserMcnRowUI(json.data);
      if (json.data.error && !json.data.mcn_end_at) {
        showToast(`Lỗi kiểm tra MCN (${json.data.username || '#' + userId}): ${json.data.error}`, 'warning');
      } else {
        showToast(`Đã cập nhật hạn MCN cho ${json.data.username || '#' + userId}`, 'success');
      }
      return;
    }
    showToast(json.error || 'Lỗi kiểm tra hạn MCN', 'error');
  } catch (err) {
    showToast('Lỗi kết nối khi kiểm tra hạn MCN', 'error');
  }
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

let _mcnPollTimer = null;

async function checkUsersMcn(btn) {
  const selectedIds = Array.from(
    document.querySelectorAll('#userTableBody tr.user-row:not(.d-none) .user-checkbox:checked')
  )
    .map(cb => parseInt(cb.dataset.userId, 10))
    .filter(id => !isNaN(id));

  const visibleIds = Array.from(
    document.querySelectorAll('#userTableBody tr.user-row:not(.d-none)')
  )
    .map(row => parseInt(row.dataset.userId, 10))
    .filter(id => !isNaN(id));

  const targetIds = selectedIds.length > 0 ? selectedIds : visibleIds;
  if (targetIds.length === 0) {
    showToast('Không có tài khoản nào để kiểm tra MCN', 'warning');
    return;
  }

  const buttonEl = btn || document.getElementById('btnCheckMcn');
  const originalHtml = buttonEl ? buttonEl.innerHTML : '<i class="bi bi-calendar-check me-1"></i>Kiểm Tra MCN';
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>KT MCN (0/${targetIds.length})`;
  }

  try {
    const startRes = await fetch('/api/users/check-mcn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: targetIds })
    });
    const startJson = await startRes.json();
    if (!startJson.success) {
      showToast(startJson.error || 'Không khởi động được kiểm tra MCN', 'error');
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.innerHTML = originalHtml;
      }
      return;
    }

    if (startJson.alreadyRunning) {
      showToast(`Đang chạy kiểm tra MCN (${startJson.done}/${startJson.total})...`, 'info');
    } else {
      showToast(`Đang kiểm tra hạn MCN cho ${startJson.total} tài khoản...`, 'info');
    }

    let since = 0;
    if (Array.isArray(startJson.updates)) {
      startJson.updates.forEach(updateUserMcnRowUI);
      since = startJson.nextIndex || startJson.updates.length;
    }

    const pollOnce = async () => {
      try {
        const sRes = await fetch(`/api/users/mcn-status?since=${since}`);
        const sJson = await sRes.json();
        if (!sJson.success) return;

        if (Array.isArray(sJson.updates) && sJson.updates.length > 0) {
          sJson.updates.forEach(updateUserMcnRowUI);
          since = sJson.nextIndex || (since + sJson.updates.length);
        }

        if (buttonEl) {
          buttonEl.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>KT MCN (${sJson.done}/${sJson.total})`;
        }

        if (!sJson.running) {
          clearInterval(_mcnPollTimer);
          _mcnPollTimer = null;
          if (buttonEl) {
            buttonEl.disabled = false;
            buttonEl.innerHTML = originalHtml;
          }
          filterUsers();
          const warnPart = sJson.expiringSoon > 0 ? ` — ⚠️ ${sJson.expiringSoon} acc còn <7 ngày!` : '';
          showToast(
            `Xong MCN (${sJson.done}/${sJson.total}): ${sJson.active} có MCN, ${sJson.none} chưa gắn, ${sJson.errors} lỗi${warnPart}`,
            sJson.expiringSoon > 0 ? 'warning' : 'success'
          );
        }
      } catch (_) {}
    };

    if (_mcnPollTimer) clearInterval(_mcnPollTimer);
    if (!startJson.running) {
      await pollOnce();
    } else {
      _mcnPollTimer = setInterval(pollOnce, 1000);
    }
  } catch (err) {
    showToast('Lỗi kết nối khi kiểm tra MCN', 'error');
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.innerHTML = originalHtml;
    }
  }
}

// === Check giỏ / chức năng video gắn link cho tài khoản không Active ===
let _inactiveCartPollTimer = null;
let _inactiveCartResults = [];
let _inactiveCartFilter = 'all';

function openCheckInactiveCartModal() {
  const pageCountry = document.getElementById('userCountryFilter')?.value || 'all';
  const modalCountryEl = document.getElementById('inactiveCartCountrySelect');
  if (modalCountryEl) {
    const valid = Array.from(modalCountryEl.options).some((o) => o.value === pageCountry);
    modalCountryEl.value = valid ? pageCountry : 'all';
  }
  const modalEl = document.getElementById('checkInactiveCartModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
  startCheckInactiveCart();
}

function setInactiveCartFilter(filter, btnEl) {
  _inactiveCartFilter = filter || 'all';
  document.querySelectorAll('#inactiveCartFilterBtns button').forEach((b) => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderInactiveCartTable();
}

function escapeHtmlCart(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInactiveCartTable() {
  const tbody = document.getElementById('inactiveCartTableBody');
  const btnCopy = document.getElementById('btnCopyUnlockedUsers');
  const btnActAll = document.getElementById('btnActivateAllUnlocked');
  if (!tbody) return;

  const unlockedPending = _inactiveCartResults.filter((r) => r.category === 'OK' && !r.activated);
  const allUnlocked = _inactiveCartResults.filter((r) => r.category === 'OK');

  if (btnCopy) btnCopy.disabled = allUnlocked.length === 0;
  if (btnActAll) {
    btnActAll.disabled = unlockedPending.length === 0;
    btnActAll.innerHTML = `<i class="bi bi-check2-circle me-1"></i>Kích hoạt tất cả TK đã mở (${unlockedPending.length})`;
  }

  let list = _inactiveCartResults.slice();
  if (_inactiveCartFilter === 'unlocked') {
    list = list.filter((r) => r.category === 'OK');
  } else if (_inactiveCartFilter === 'locked') {
    list = list.filter(
      (r) =>
        r.category !== 'OK' &&
        r.category !== 'DEAD_COOKIE' &&
        r.category !== 'NO_COOKIE' &&
        r.category !== 'NET_ERR'
    );
  } else if (_inactiveCartFilter === 'issue') {
    list = list.filter(
      (r) => r.category === 'DEAD_COOKIE' || r.category === 'NO_COOKIE' || r.category === 'NET_ERR'
    );
  }

  // Đẩy các TK đã mở lại (OK) lên đầu bảng
  const rank = (cat) => {
    if (cat === 'OK') return 0;
    if (cat === 'NO_AFFILIATE' || cat === 'AFF_FROZEN') return 1;
    if (cat === 'DEAD_COOKIE' || cat === 'NO_COOKIE') return 3;
    if (cat === 'NET_ERR') return 4;
    return 2;
  };
  list.sort((a, b) => rank(a.category) - rank(b.category) || String(a.username).localeCompare(String(b.username)));

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Không có tài khoản nào trong mục này.</td></tr>';
    return;
  }

  tbody.innerHTML = list
    .map((r, i) => {
      let badgeCls = 'bg-danger';
      if (r.category === 'OK') badgeCls = 'bg-success';
      else if (r.category === 'DEAD_COOKIE' || r.category === 'NO_COOKIE') badgeCls = 'bg-secondary';
      else if (r.category === 'NET_ERR') badgeCls = 'bg-warning text-dark';

      const rowCls = r.category === 'OK' ? 'table-success' : '';
      let actionHtml = '<span class="text-muted small">-</span>';
      if (r.category === 'OK') {
        actionHtml = r.activated
          ? '<span class="badge bg-success-subtle text-success border border-success">Đã kích hoạt</span>'
          : `<button type="button" class="btn btn-success btn-sm py-0 px-2" onclick="activateSingleUnlockedCartUser(${r.id}, this)">Kích hoạt</button>`;
      }

      const proxyNote = r.ownProxyFailed ? ' <span class="badge bg-warning text-dark" title="Proxy riêng của TK lỗi, đã dùng proxy dự phòng để check">Proxy lỗi</span>' : '';
      return `
        <tr class="${rowCls}">
          <td class="text-muted">${i + 1}</td>
          <td><strong>${escapeHtmlCart(r.username)}</strong>${proxyNote}</td>
          <td><span class="badge bg-light text-dark border text-uppercase">${escapeHtmlCart(r.country || 'vn')}</span></td>
          <td><span class="badge ${badgeCls}">${escapeHtmlCart(r.label || r.category)}</span></td>
          <td class="text-muted font-monospace" style="font-size:0.74rem;">${escapeHtmlCart(r.detail || '')}</td>
          <td class="text-center">${actionHtml}</td>
        </tr>
      `;
    })
    .join('');
}

function updateInactiveCartProgressUI(st) {
  const bar = document.getElementById('inactiveCartProgressBar');
  const label = document.getElementById('inactiveCartProgressLabel');
  const pctEl = document.getElementById('inactiveCartProgressPct');
  const bUnl = document.getElementById('cartBadgeUnlocked');
  const bLock = document.getElementById('cartBadgeLocked');
  const bDead = document.getElementById('cartBadgeDeadCookie');
  const bErr = document.getElementById('cartBadgeNetErr');
  const topBtn = document.getElementById('btnCheckInactiveCart');
  const scanBtn = document.getElementById('btnStartInactiveCartScan');

  const total = st.total || 0;
  const done = st.done || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 100;

  if (bUnl) bUnl.textContent = `Đã mở lại: ${st.unlocked || 0}`;
  if (bLock) bLock.textContent = `Vẫn khóa: ${st.locked || 0}`;
  if (bDead) bDead.textContent = `Cookie chết: ${st.deadCookie || 0}`;
  if (bErr) bErr.textContent = `Lỗi mạng: ${st.errors || 0}`;
  if (pctEl) pctEl.textContent = `${pct}%`;

  if (bar) {
    bar.style.width = `${pct}%`;
    if (st.running) {
      bar.className = 'progress-bar progress-bar-striped progress-bar-animated bg-warning';
    } else {
      bar.className = (st.unlocked || 0) > 0 ? 'progress-bar bg-success' : 'progress-bar bg-secondary';
    }
  }

  if (label) {
    if (total === 0) {
      label.textContent = 'Không có tài khoản nào đang tắt kích hoạt (không Active) trong phạm vi đã chọn.';
    } else if (st.running) {
      label.textContent = `Đang kiểm tra giỏ hàng: ${done} / ${total} tài khoản không Active...`;
    } else {
      label.textContent = `Hoàn tất kiểm tra ${done} / ${total} tài khoản — Phát hiện ${st.unlocked || 0} tài khoản đã được Shopee mở lại giỏ!`;
    }
  }

  if (scanBtn) scanBtn.disabled = Boolean(st.running);
  if (topBtn) {
    if (st.running) {
      topBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Check giỏ (${done}/${total})`;
    } else {
      topBtn.innerHTML = '<i class="bi bi-bag-check me-1"></i>Check giỏ TK không Active';
    }
  }
}

async function startCheckInactiveCart() {
  const country = document.getElementById('inactiveCartCountrySelect')?.value || 'all';
  const scanBtn = document.getElementById('btnStartInactiveCartScan');
  if (scanBtn) scanBtn.disabled = true;

  if (_inactiveCartPollTimer) {
    clearInterval(_inactiveCartPollTimer);
    _inactiveCartPollTimer = null;
  }

  try {
    const startRes = await fetch('/api/users/check-inactive-cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country })
    });
    const startJson = await startRes.json();
    if (!startJson.success) {
      showToast(startJson.error || 'Không khởi chạy được kiểm tra giỏ hàng', 'error');
      if (scanBtn) scanBtn.disabled = false;
      return;
    }

    _inactiveCartResults = Array.isArray(startJson.updates) ? startJson.updates.slice() : [];
    let since = startJson.nextIndex || _inactiveCartResults.length;
    updateInactiveCartProgressUI(startJson);
    renderInactiveCartTable();

    if (!startJson.running) {
      if (startJson.total === 0) {
        showToast('Không có tài khoản nào đang không Active để kiểm tra', 'info');
      }
      return;
    }

    if (startJson.alreadyRunning) {
      showToast(`Đang chạy kiểm tra giỏ (${startJson.done}/${startJson.total})...`, 'info');
    }

    const pollOnce = async () => {
      try {
        const res = await fetch(`/api/users/video-cart-status?since=${since}`);
        const st = await res.json();
        if (!st.success) return;

        if (Array.isArray(st.updates) && st.updates.length > 0) {
          _inactiveCartResults.push(...st.updates);
          since = st.nextIndex || (since + st.updates.length);
        }
        updateInactiveCartProgressUI(st);
        renderInactiveCartTable();

        if (!st.running) {
          clearInterval(_inactiveCartPollTimer);
          _inactiveCartPollTimer = null;
          showToast(
            `Xong kiểm tra ${st.done}/${st.total} TK không Active: ${st.unlocked} đã mở lại, ${st.locked} vẫn khóa, ${st.deadCookie} cookie chết`,
            st.unlocked > 0 ? 'success' : 'info'
          );
        }
      } catch (_) {}
    };

    _inactiveCartPollTimer = setInterval(pollOnce, 800);
  } catch (err) {
    showToast('Lỗi kết nối khi kiểm tra giỏ TK không Active', 'error');
    if (scanBtn) scanBtn.disabled = false;
  }
}

async function activateUnlockedCartUserIds(userIds, triggerBtn) {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  const origHtml = triggerBtn ? triggerBtn.innerHTML : '';
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang bật...';
  }
  try {
    const res = await fetch('/api/users/activate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds })
    });
    const json = await res.json();
    if (!json.success) {
      showToast(json.error || 'Lỗi kích hoạt tài khoản', 'error');
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.innerHTML = origHtml;
      }
      return;
    }

    const idSet = new Set(userIds.map(Number));
    _inactiveCartResults.forEach((r) => {
      if (idSet.has(Number(r.id))) {
        r.is_active = 1;
        r.activated = true;
      }
    });
    // Đồng bộ ngay switch ngoài bảng Quản Lý Người Dùng
    idSet.forEach((uid) => {
      const sw = document.getElementById('userActiveSwitch_' + uid);
      if (sw) sw.checked = true;
    });

    renderInactiveCartTable();
    showToast(`Đã kích hoạt lại ${json.updated} tài khoản đã mở giỏ!`, 'success');
  } catch (err) {
    showToast('Lỗi kết nối khi kích hoạt tài khoản', 'error');
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = origHtml;
    }
  }
}

function activateSingleUnlockedCartUser(userId, btn) {
  activateUnlockedCartUserIds([Number(userId)], btn);
}

function activateAllUnlockedCartUsers(btn) {
  const ids = _inactiveCartResults
    .filter((r) => r.category === 'OK' && !r.activated)
    .map((r) => Number(r.id));
  if (ids.length === 0) {
    showToast('Không có tài khoản mới nào cần kích hoạt', 'info');
    return;
  }
  activateUnlockedCartUserIds(ids, btn);
}

function copyUnlockedCartUsernames() {
  const names = _inactiveCartResults.filter((r) => r.category === 'OK').map((r) => r.username);
  if (names.length === 0) {
    showToast('Chưa có tài khoản nào được mở lại giỏ', 'warning');
    return;
  }
  const text = names.join('\n');
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(`Đã copy ${names.length} username đã mở lại giỏ`, 'success');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast(`Đã copy ${names.length} username đã mở lại giỏ`, 'success'))
      .catch(fallback);
  } else {
    fallback();
  }
}


