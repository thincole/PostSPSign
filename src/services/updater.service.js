const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');

class UpdaterService {
  constructor() {
    this.repoOwner = 'thincole';
    this.repoName = 'PostSPSign';
    this.repoUrl = `https://github.com/${this.repoOwner}/${this.repoName}`;
    this.commitFilePath = path.join(process.cwd(), '.current_commit');
    this.versionFilePath = path.join(process.cwd(), 'VERSION');
    this.exclusions = [
      'node.exe',
      'bin',
      'day-code-github.bat',
      '.env',
      '.machine_id',
      'database.sqlite',
      'database.sqlite-shm',
      'database.sqlite-wal',
      'app.db',
      'adb_selected_devices.json',
      'sp_phone_backup',
      'cookie_shopee',
      'uploads',
      'node_modules',
      '.git',
      'temp_update',
      'temp_update_bat'
    ];
  }

  getCurrentCommit() {
    try {
      if (fs.existsSync(this.commitFilePath)) {
        return fs.readFileSync(this.commitFilePath, 'utf8').trim();
      }
      if (fs.existsSync(this.versionFilePath)) {
        return fs.readFileSync(this.versionFilePath, 'utf8').trim();
      }
    } catch (err) {
      console.error('Error reading current commit:', err.message);
    }
    return '26.0.1';
  }

  setCurrentCommit(sha) {
    try {
      fs.writeFileSync(this.commitFilePath, sha, 'utf8');
    } catch (err) {
      console.error('Error writing current commit:', err.message);
    }
  }

  getHeaders() {
    const headers = {
      'User-Agent': 'Shopee-Video-Uploader-Updater',
      'Accept': 'application/vnd.github.v3+json'
    };
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
    return headers;
  }

  async checkUpdate() {
    const currentCommit = this.getCurrentCommit();
    let branches = ['main', 'master'];
    let latestCommitData = null;
    let branchUsed = 'main';

    for (const branch of branches) {
      try {
        const url = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/commits/${branch}`;
        const res = await axios.get(url, { headers: this.getHeaders(), timeout: 10000 });
        if (res.data && res.data.sha) {
          latestCommitData = res.data;
          branchUsed = branch;
          break;
        }
      } catch (err) {
        // Try next branch if 404
      }
    }

    if (!latestCommitData) {
      // Try latest releases as fallback
      try {
        const url = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;
        const res = await axios.get(url, { headers: this.getHeaders(), timeout: 10000 });
        if (res.data && res.data.tag_name) {
          const isNewer = currentCommit !== res.data.tag_name;
          return {
            hasUpdate: isNewer,
            currentCommit,
            latestCommit: res.data.tag_name,
            commitMessage: res.data.name || res.data.body || 'Release ' + res.data.tag_name,
            commitDate: res.data.published_at,
            branch: 'release',
            zipUrl: res.data.zipball_url || `${this.repoUrl}/archive/refs/tags/${res.data.tag_name}.zip`
          };
        }
      } catch (releaseErr) {
        console.error('Failed to fetch commit or release info:', releaseErr.message);
      }

      return {
        hasUpdate: false,
        currentCommit,
        latestCommit: currentCommit,
        commitMessage: 'Không thể kết nối đến GitHub hoặc repository chưa có commit công khai.',
        error: 'Cannot connect to GitHub repository'
      };
    }

    const latestSha = latestCommitData.sha;
    const shortSha = latestSha.substring(0, 7);
    const commitMessage = latestCommitData.commit?.message || 'Update từ GitHub';
    const commitDate = latestCommitData.commit?.author?.date || new Date().toISOString();
    let localVersion = '';
    try {
      if (fs.existsSync(this.versionFilePath)) {
        localVersion = fs.readFileSync(this.versionFilePath, 'utf8').trim();
      }
    } catch (_) {}
    const msgVerMatch = commitMessage.match(/(\d+\.\d+\.\d+)/);
    const remoteVersion = msgVerMatch ? msgVerMatch[1] : '';
    const localVerNum = (localVersion.match(/(\d+\.\d+\.\d+)/) || [])[1] || '';
    const sameVersion = Boolean(remoteVersion && localVerNum && remoteVersion === localVerNum);
    const hasUpdate = !sameVersion && currentCommit !== latestSha && currentCommit !== shortSha;

    return {
      hasUpdate,
      currentCommit: localVersion || currentCommit,
      latestCommit: remoteVersion ? `V${remoteVersion} (${shortSha})` : shortSha,
      fullSha: latestSha,
      commitMessage,
      commitDate,
      branch: branchUsed,
      zipUrl: `${this.repoUrl}/archive/refs/heads/${branchUsed}.zip`
    };
  }

  async performUpdate() {
    const checkResult = await this.checkUpdate();
    const zipUrl = checkResult.zipUrl || `${this.repoUrl}/archive/refs/heads/${checkResult.branch || 'main'}.zip`;
    const targetSha = checkResult.fullSha || checkResult.latestCommit || 'updated';

    const tempDir = path.join(process.cwd(), 'temp_update');
    const zipPath = path.join(tempDir, 'update.zip');
    const extractDir = path.join(tempDir, 'extracted');

    try {
      // 1. Prepare temp directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });
      fs.mkdirSync(extractDir, { recursive: true });

      // 2. Download ZIP from GitHub
      const response = await axios({
        method: 'get',
        url: zipUrl,
        responseType: 'arraybuffer',
        headers: this.getHeaders(),
        timeout: 60000
      });

      fs.writeFileSync(zipPath, Buffer.from(response.data));

      // 3. Extract ZIP using PowerShell
      const psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force"`;
      execSync(psCommand, { stdio: 'inherit' });

      // 4. Locate extracted directory
      const extractedItems = fs.readdirSync(extractDir);
      let sourceRoot = extractDir;
      if (extractedItems.length === 1) {
        const singleItem = path.join(extractDir, extractedItems[0]);
        if (fs.statSync(singleItem).isDirectory()) {
          sourceRoot = singleItem;
        }
      }

      // 5. Copy files recursively while honoring exclusions
      this.copyDirectoryRecursive(sourceRoot, process.cwd());

      // 6. Save current commit SHA
      this.setCurrentCommit(targetSha);

      // 7. Cleanup temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });

      return {
        success: true,
        message: 'Cập nhật hoàn tất thành công! Vui lòng khởi động lại phần mềm để áp dụng các thay đổi mới.',
        commit: targetSha
      };
    } catch (err) {
      console.error('Update execution error:', err);
      // Cleanup on failure
      if (fs.existsSync(tempDir)) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
      }
      throw new Error(`Cập nhật thất bại: ${err.message}`);
    }
  }

  copyDirectoryRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const items = fs.readdirSync(src);
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);

      // Check exclusions
      if (this.isExcluded(item, destPath)) {
        continue;
      }

      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        this.copyDirectoryRecursive(srcPath, destPath);
      } else {
        try {
          fs.copyFileSync(srcPath, destPath);
        } catch (copyErr) {
          console.warn(`Warning: Could not overwrite file ${item}:`, copyErr.message);
        }
      }
    }
  }

  isExcluded(itemName, fullDestPath) {
    if (this.exclusions.includes(itemName)) {
      return true;
    }
    if (itemName.endsWith('.rar') || itemName.endsWith('.zip')) {
      return true;
    }
    const relativePath = path.relative(process.cwd(), fullDestPath);
    if (relativePath.startsWith('uploads') || relativePath.startsWith('node_modules')) {
      return true;
    }
    return false;
  }
}

module.exports = new UpdaterService();
