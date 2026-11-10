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
  const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
  const selectedCountry = countryFilter ? countryFilter.value : 'all';

  const rows = document.querySelectorAll('#userTableBody tr.user-row');
  let visibleCount = 0;

  rows.forEach((row) => {
    const country = (row.dataset.country || 'vn').toLowerCase();
    const username = (row.dataset.username || '').toLowerCase();
    const proxy = (row.dataset.proxy || '').toLowerCase();
    const cookie = (row.querySelector('input[readonly]')?.value || '').toLowerCase();

    const matchCountry = selectedCountry === 'all' || country === selectedCountry;
    const matchQuery = !query || username.includes(query) || proxy.includes(query) || cookie.includes(query);

    if (matchCountry && matchQuery) {
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
    if (selectedCountry === 'all' && !query) {
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


