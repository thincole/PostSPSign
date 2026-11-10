let allLogsCache = [];

function loadLogs(page = 1) {
  const pageSize = document.getElementById('logPageSize').value;
  const statusFilter = document.getElementById('logStatusFilter')?.value || '';

  let url = `/api/logs?page=${page}&pageSize=${pageSize}`;
  if (statusFilter) {
    url += `&status=${statusFilter}`;
  }

  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      allLogsCache = data.logs || [];
      renderLogs(data);
      updateLogStats(data);
    })
    .catch((error) => {
      console.error('Error loading logs:', error);
      document.getElementById('logsTable').innerHTML =
        '<tr><td colspan="6" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle me-2"></i>Lỗi tải dữ liệu</td></tr>';
    });
}

function renderLogs(data) {
  const logsTable = document.getElementById('logsTable');
  const logs = data.logs || [];

  if (logs.length === 0) {
    logsTable.innerHTML =
      '<tr><td colspan="6" class="text-center text-muted py-4"><i class="bi bi-inbox me-2"></i>Chưa có nhật ký nào</td></tr>';
    document.getElementById('logPagination').innerHTML = '';
    document.getElementById('logPaginationInfo').textContent = 'Không có dữ liệu';
    return;
  }

  logsTable.innerHTML = logs
    .map((log, index) => {
      const rowNum = (data.page - 1) * data.pageSize + index + 1;
      const isSuccess = log.status === 'success';
      const statusBadge = isSuccess
        ? '<span class="badge bg-success"><i class="bi bi-check-lg me-1"></i>OK</span>'
        : '<span class="badge bg-danger"><i class="bi bi-x-lg me-1"></i>Lỗi</span>';

      // Build detail column
      let detail = '';
      let productInfo = '';

      if (isSuccess && log.post_id) {
        detail = `<span class="text-success"><i class="bi bi-link-45deg me-1"></i>Đăng thành công</span>`;

        // Parse extra_info nếu có (thông tin SP tương tự)
        if (log.extra_info) {
          try {
            const extra = JSON.parse(log.extra_info);
            if (extra.added > 0) {
              detail += ` <span class="badge bg-info" style="font-size:0.65rem">+${extra.added} SP</span>`;
              // Build product links list
              const links = (extra.products || []).map((url, i) => {
                const isAdded = i >= extra.original;
                const icon = isAdded ? '🆕' : '📦';
                const label = isAdded ? 'Thêm' : 'Gốc';
                return `<a href="${escapeHtml(url)}" target="_blank" class="text-decoration-none small d-block" title="${label}">
                  ${icon} <span class="${isAdded ? 'text-info' : 'text-muted'}">${escapeHtml(url.replace('https://shopee.vn/product/', ''))}</span>
                </a>`;
              }).join('');
              productInfo = `
                <div class="mt-1">
                  <button class="btn btn-sm btn-outline-secondary py-0 px-1" style="font-size:0.65rem" onclick="this.nextElementSibling.classList.toggle('d-none')">
                    <i class="bi bi-bag me-1"></i>${extra.original} gốc + ${extra.added} thêm = ${extra.total} SP
                  </button>
                  <div class="d-none mt-1 ps-2 border-start border-info" style="font-size:0.7rem">${links}</div>
                </div>`;
            }
          } catch {}
        }
      } else if (!isSuccess) {
        const errorMsg = log.error || 'Không rõ lỗi';
        const failedFn = log.failed_function ? ` <span class="text-muted">[${log.failed_function}]</span>` : '';
        detail = `<span class="log-error-cell text-danger" title="${escapeHtml(errorMsg)}">${escapeHtml(errorMsg)}${failedFn}</span>`;
      } else {
        detail = '<span class="text-muted">-</span>';
      }

      const timeStr = formatLogTime(log.created_at);

      return `
        <tr class="${isSuccess ? '' : 'table-danger bg-opacity-10'}">
          <td class="text-muted">${rowNum}</td>
          <td><small>${timeStr}</small></td>
          <td><strong>${escapeHtml(log.username)}</strong></td>
          <td>${statusBadge}</td>
          <td>${detail}${productInfo}</td>
          <td>${log.post_id ? (() => {
            let videoUrl = '';
            try { const ex = JSON.parse(log.extra_info || '{}'); videoUrl = ex.link || ''; } catch {}
            if (!videoUrl && log.post_id) {
              // Default VN, detect từ extra_info hoặc fallback
              videoUrl = 'https://sv.shopee.vn/share-video/' + log.post_id;
            }
            return videoUrl
              ? `<a href="${escapeHtml(videoUrl)}" target="_blank" class="text-decoration-none"><code class="small">${escapeHtml(log.post_id.substring(0, 20))}...</code> <i class="bi bi-box-arrow-up-right" style="font-size:0.6rem"></i></a>`
              : `<code class="small">${escapeHtml(log.post_id)}</code>`;
          })() : '<span class="text-muted">-</span>'}</td>
        </tr>`;
    })
    .join('');

  // Pagination
  renderLogPagination(data.page, data.totalPages);

  // Info text
  const start = (data.page - 1) * data.pageSize + 1;
  const end = Math.min(data.page * data.pageSize, data.total);
  document.getElementById('logPaginationInfo').textContent =
    `Hiển thị ${start}-${end} / ${data.total} dòng (Trang ${data.page}/${data.totalPages})`;
}

function renderLogPagination(current, totalPages) {
  const pagination = document.getElementById('logPagination');
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';

  // Previous
  html += `<li class="page-item ${current === 1 ? 'disabled' : ''}">
    <button class="page-link" onclick="loadLogs(${current - 1})" ${current === 1 ? 'disabled' : ''}>
      <i class="bi bi-chevron-left"></i>
    </button>
  </li>`;

  // Smart page numbers with ellipsis
  const pages = getVisiblePages(current, totalPages);
  let prev = 0;
  pages.forEach((p) => {
    if (p - prev > 1) {
      html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
    }
    html += `<li class="page-item ${p === current ? 'active' : ''}">
      <button class="page-link" onclick="loadLogs(${p})" ${p === current ? 'disabled' : ''}>${p}</button>
    </li>`;
    prev = p;
  });

  // Next
  html += `<li class="page-item ${current === totalPages ? 'disabled' : ''}">
    <button class="page-link" onclick="loadLogs(${current + 1})" ${current === totalPages ? 'disabled' : ''}>
      <i class="bi bi-chevron-right"></i>
    </button>
  </li>`;

  pagination.innerHTML = html;
}

function getVisiblePages(current, total) {
  const pages = new Set();
  // Always show first, last, and range around current
  pages.add(1);
  pages.add(total);
  for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) {
    pages.add(i);
  }
  return [...pages].sort((a, b) => a - b);
}

function updateLogStats(data) {
  const logs = data.logs || [];
  const success = logs.filter((l) => l.status === 'success').length;
  const error = logs.filter((l) => l.status === 'error').length;

  document.getElementById('logSuccessCount').textContent = success;
  document.getElementById('logErrorCount').textContent = error;
  document.getElementById('logTotalCount').textContent = data.total || 0;
}

function filterLogs() {
  const query = (document.getElementById('logSearchInput')?.value || '').toLowerCase();
  const rows = document.querySelectorAll('#logsTable tr');

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}

function exportLogs() {
  const statusFilter = document.getElementById('logStatusFilter')?.value || '';
  let url = '/api/logs/export';
  if (statusFilter) url += `?status=${statusFilter}`;

  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Đang tải file logs...', 'success');
}

function clearAllLogs() {
  if (!confirm('Bạn có chắc muốn xóa tất cả nhật ký?')) return;

  fetch('/api/logs', { method: 'DELETE' })
    .then((res) => res.json())
    .then(() => {
      showToast('Đã xóa tất cả nhật ký', 'success');
      loadLogs();
    })
    .catch(() => showToast('Lỗi khi xóa nhật ký', 'error'));
}

function formatLogTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  loadLogs();
  document.getElementById('logPageSize').addEventListener('change', () => loadLogs());
});
