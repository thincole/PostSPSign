document.addEventListener('DOMContentLoaded', () => {
  const btnOpenUpdateModal = document.getElementById('btnOpenUpdateModal');
  const updateModalEl = document.getElementById('updateModal');
  const updateModal = updateModalEl ? new bootstrap.Modal(updateModalEl) : null;

  const loadingState = document.getElementById('updateLoadingState');
  const contentState = document.getElementById('updateContentState');
  const alertContainer = document.getElementById('updateAlertContainer');
  const currentVersionBadge = document.getElementById('currentVersionBadge');
  const latestCommitBadge = document.getElementById('latestCommitBadge');
  const commitMessageText = document.getElementById('commitMessageText');
  const commitDateText = document.getElementById('commitDateText');
  const progressContainer = document.getElementById('updateProgressContainer');
  const progressBar = document.getElementById('updateProgressBar');
  const progressStatus = document.getElementById('updateProgressStatus');
  const progressPercent = document.getElementById('updateProgressPercent');

  const btnCheckAgain = document.getElementById('btnCheckUpdateAgain');
  const btnApplyUpdate = document.getElementById('btnApplyUpdate');
  const githubUpdateBadge = document.getElementById('githubUpdateBadge');

  let updateInfo = null;

  async function checkUpdate(showModalOnCheck = false) {
    if (showModalOnCheck && updateModal) {
      updateModal.show();
    }

    if (loadingState) loadingState.classList.remove('d-none');
    if (contentState) contentState.classList.add('d-none');
    if (btnApplyUpdate) btnApplyUpdate.disabled = true;

    try {
      const response = await fetch('/api/update/check');
      const data = await response.json();
      updateInfo = data;

      if (loadingState) loadingState.classList.add('d-none');
      if (contentState) contentState.classList.remove('d-none');

      if (data.error) {
        alertContainer.innerHTML = `
          <div class="alert alert-warning py-2 px-3 mb-0 d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-triangle-fill fs-5"></i>
            <div>${data.error}</div>
          </div>`;
        if (latestCommitBadge) latestCommitBadge.textContent = 'N/A';
        if (commitMessageText) commitMessageText.textContent = data.commitMessage || 'Không thể kiểm tra';
        return;
      }

      if (currentVersionBadge) currentVersionBadge.textContent = data.currentCommit || 'v13.3';
      if (latestCommitBadge) latestCommitBadge.textContent = data.latestCommit || 'Unknown';
      if (commitMessageText) commitMessageText.textContent = data.commitMessage || 'Không có mô tả';
      if (commitDateText) {
        commitDateText.textContent = data.commitDate ? new Date(data.commitDate).toLocaleString('vi-VN') : '---';
      }

      if (data.hasUpdate) {
        alertContainer.innerHTML = `
          <div class="alert alert-success py-2 px-3 mb-0 d-flex align-items-center gap-2">
            <i class="bi bi-gift-fill fs-5 text-success"></i>
            <div><strong>Đã có bản cập nhật mới!</strong> Bấm nút <b>Cập Nhật Ngay</b> để nâng cấp ứng dụng.</div>
          </div>`;
        if (btnApplyUpdate) btnApplyUpdate.disabled = false;

        if (githubUpdateBadge) {
          githubUpdateBadge.classList.remove('d-none');
          githubUpdateBadge.innerHTML = `<i class="bi bi-arrow-up-circle-fill me-1"></i>Có bản mới (${data.latestCommit})`;
        }
      } else {
        alertContainer.innerHTML = `
          <div class="alert alert-info py-2 px-3 mb-0 d-flex align-items-center gap-2">
            <i class="bi bi-check-circle-fill fs-5 text-info"></i>
            <div>Bạn đang sử dụng phiên bản mới nhất từ GitHub.</div>
          </div>`;
        if (btnApplyUpdate) btnApplyUpdate.disabled = true;

        if (githubUpdateBadge) {
          githubUpdateBadge.classList.add('d-none');
        }
      }
    } catch (err) {
      console.error('Failed to check update:', err);
      if (loadingState) loadingState.classList.add('d-none');
      if (contentState) contentState.classList.remove('d-none');
      alertContainer.innerHTML = `
        <div class="alert alert-danger py-2 px-3 mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-x-circle-fill fs-5"></i>
          <div>Lỗi kết nối đến máy chủ cập nhật.</div>
        </div>`;
    }
  }

  async function applyUpdate() {
    if (!confirm('Bạn có chắc chắn muốn tiến hành tải bản cập nhật mới từ GitHub?')) {
      return;
    }

    if (btnApplyUpdate) btnApplyUpdate.disabled = true;
    if (btnCheckAgain) btnCheckAgain.disabled = true;
    if (progressContainer) progressContainer.classList.remove('d-none');

    let currentPercent = 10;
    progressBar.style.width = '10%';
    progressPercent.textContent = '10%';
    progressStatus.textContent = 'Đang tải bản cập nhật từ GitHub...';

    const interval = setInterval(() => {
      if (currentPercent < 85) {
        currentPercent += 5;
        progressBar.style.width = currentPercent + '%';
        progressPercent.textContent = currentPercent + '%';
        if (currentPercent > 50) {
          progressStatus.textContent = 'Đang giải nén và cập nhật các tệp nguồn...';
        }
      }
    }, 500);

    try {
      const response = await fetch('/api/update/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      clearInterval(interval);

      if (result.success) {
        progressBar.style.width = '100%';
        progressPercent.textContent = '100%';
        progressStatus.textContent = 'Cập nhật hoàn tất!';

        alertContainer.innerHTML = `
          <div class="alert alert-success py-3 px-3 mb-0">
            <h6 class="fw-bold mb-1"><i class="bi bi-check-circle-fill me-1"></i> Cập Nhật Thành Công!</h6>
            <p class="mb-2" style="font-size: 0.82rem;">${result.message}</p>
            <button class="btn btn-sm btn-success w-100 fw-bold" onclick="location.reload()">
              <i class="bi bi-arrow-clockwise me-1"></i> Tải lại trang web
            </button>
          </div>`;
        if (showToast) showToast('Cập nhật ứng dụng thành công!', 'success');
      } else {
        progressBar.style.width = '0%';
        if (progressContainer) progressContainer.classList.add('d-none');
        alertContainer.innerHTML = `
          <div class="alert alert-danger py-2 px-3 mb-0">
            <strong>Lỗi cập nhật:</strong> ${result.message || 'Không thể ghi đè bản cập nhật.'}
          </div>`;
        if (btnApplyUpdate) btnApplyUpdate.disabled = false;
      }
    } catch (err) {
      clearInterval(interval);
      if (progressContainer) progressContainer.classList.add('d-none');
      alertContainer.innerHTML = `
        <div class="alert alert-danger py-2 px-3 mb-0">
          <strong>Lỗi hệ thống:</strong> ${err.message || 'Kết nối thất bại trong quá trình cập nhật.'}
        </div>`;
      if (btnApplyUpdate) btnApplyUpdate.disabled = false;
    } finally {
      if (btnCheckAgain) btnCheckAgain.disabled = false;
    }
  }

  // Event Listeners
  if (btnOpenUpdateModal) {
    btnOpenUpdateModal.addEventListener('click', () => checkUpdate(true));
  }

  if (btnCheckAgain) {
    btnCheckAgain.addEventListener('click', () => checkUpdate(false));
  }

  if (btnApplyUpdate) {
    btnApplyUpdate.addEventListener('click', applyUpdate);
  }

  // Auto check for update silently on page load
  setTimeout(() => {
    checkUpdate(false);
  }, 2000);
});
