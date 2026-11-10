const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

function removeDiacritics(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function normalizeHeader(str) {
  if (!str) return '';
  return removeDiacritics(str.toLowerCase())
    .replace(/[^a-z0-9\s&]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const COL_KEYWORDS = {
  account: ['account', 'accounts', 'nick_koc', 'tai khoan'],
  video_file: ['file video', 'ten file video', 'video file', 'link_video'],
  product_link: ['link san pham', 'link sp', 'product_link', 'san pham'],
  caption: ['noi dung', 'caption', 'hashtag', 'nd_video']
};

function parseExcel(filePath, sheetName = null) {
  const workbook = XLSX.readFile(filePath);
  let targetSheetName = null;
  if (sheetName) {
    const sNameLower = String(sheetName).trim().toLowerCase();
    targetSheetName = workbook.SheetNames.find(s => String(s).trim().toLowerCase() === sNameLower);
  }
  if (!targetSheetName) {
    targetSheetName = workbook.SheetNames[0];
  }
  const worksheet = workbook.Sheets[targetSheetName];
  
  // Use defval to ensure all cells have at least an empty string
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  
  if (rawRows.length === 0) {
    return { rows: [], colMap: {}, error: 'File Excel trống' };
  }
  
  // Find column mapping
  const headers = Object.keys(rawRows[0]);
  const colMap = {};
  
  for (const [colName, keywords] of Object.entries(COL_KEYWORDS)) {
    for (const header of headers) {
      const normalizedHeaderName = normalizeHeader(header);
      for (const keyword of keywords) {
        if (normalizedHeaderName.includes(keyword) || normalizedHeaderName === keyword) {
          colMap[colName] = header;
          break;
        }
      }
      if (colMap[colName]) break;
    }
  }
  
  if (!colMap.account) {
    return { rows: [], colMap, error: 'Không tìm thấy cột "Tên Account" trong Excel' };
  }
  if (!colMap.video_file) {
    return { rows: [], colMap, error: 'Không tìm thấy cột "File Video" trong Excel' };
  }
  
  // Single-pass mapping and filtering to optimize memory and CPU
  const processedRows = [];
  const accountCol = colMap.account;
  const videoCol = colMap.video_file;
  const productCol = colMap.product_link;
  const captionCol = colMap.caption;

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    const account = String(rawRow[accountCol] || '').trim();
    const video_file = String(rawRow[videoCol] || '').trim();
    
    // Only parse details for valid rows to save memory and time
    if (account && video_file) {
      const product_links = productCol ? parseProductLinks(String(rawRow[productCol] || '')) : [];
      const caption = captionCol ? String(rawRow[captionCol] || '').trim() : '';
      
      processedRows.push({
        index: i + 2, // 1-indexed row number offset (row 1 is header)
        account,
        video_file,
        product_links,
        caption,
        _raw: rawRow
      });
    }
  }
  
  return { rows: processedRows, colMap, error: null };
}

function parseProductLinks(linkString) {
  if (!linkString || !linkString.trim()) return [];
  
  let formattedString = linkString.replace(/https:\/\//g, '|https://');
  const rawUrls = formattedString
    .split(/[|\n]/)
    .map(url => url.trim())
    .filter(url => url.length > 0 && url.startsWith('http'));
    
  const links = [];
  for (const url of rawUrls) {
    const shopeeIds = extractShopeeIds(url);
    if (shopeeIds) {
      links.push({
        ...shopeeIds,
        link: url
      });
    }
  }
  return links.slice(0, 6); // Limit to maximum 6 products
}

function extractShopeeIds(url) {
  if (!url || typeof url !== "string") return null;
  const patterns = [
    /shopee\.(?:co\.id|co\.th|com\.my|com\.br|vn|sg|ph|[a-z.]+)\/[^/]+-i\.(\d+)\.(\d+)/,
    /shopee\.(?:co\.id|co\.th|com\.my|com\.br|vn|sg|ph|[a-z.]+)\/(?:sp|shop|product)\/(\d+)\/(\d+)/,
    /shopee\.(?:co\.id|co\.th|com\.my|com\.br|vn|sg|ph|[a-z.]+)\/i\/(\d+)\/(\d+)/,
    /\/(\d{6,})\/(\d{6,})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        shop_id: parseInt(match[1], 10),
        item_id: parseInt(match[2], 10)
      };
    }
  }
  return null;
}

function validateRows(rows, videoFolder, users) {
  const userMap = new Map();
  for (const user of users) {
    userMap.set(user.username.toLowerCase(), user);
  }
  
  let videoFilesSet = new Set();
  try {
    const dirContents = fs.readdirSync(videoFolder);
    videoFilesSet = new Set(dirContents.filter(file => /\.(mp4|mov|avi|mkv|webm|flv|m4v)$/i.test(file)));
  } catch (error) {
    return {
      valid: [],
      invalid: rows.map(row => ({ ...row, error: 'Folder video không tồn tại' })),
      summary: {
        total: rows.length,
        valid: 0,
        invalid: rows.length,
        errors: { folder: rows.length }
      }
    };
  }
  
  // Pre-compute lookup maps for O(1) matching instead of O(M) loop for each of the N rows
  const videoFileLowerCaseMap = new Map();
  const videoFileBaseNameMap = new Map();
  
  for (const filename of videoFilesSet) {
    const lowerName = filename.toLowerCase();
    videoFileLowerCaseMap.set(lowerName, filename);
    
    const parsed = path.parse(filename);
    videoFileBaseNameMap.set(parsed.name.toLowerCase(), filename);
  }
  
  const validRows = [];
  const invalidRows = [];
  const errorsSummary = {
    account_not_found: 0,
    video_not_found: 0,
    no_product: 0
  };
  
  const extensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
  
  for (const row of rows) {
    const rawAcc = String(row.account || '').trim();
    const accountLower = rawAcc.toLowerCase();
    const systemUser = userMap.get(accountLower);
    
    if (!systemUser) {
      errorsSummary.account_not_found++;
      invalidRows.push({
        ...row,
        error: `Account "${row.account}" không tìm thấy trong hệ thống`
      });
      continue;
    }
    
    let matchedFilename = null;
    const fileLower = row.video_file.toLowerCase();
    
    // O(1) matching strategy
    if (videoFilesSet.has(row.video_file)) {
      matchedFilename = row.video_file;
    } else if (videoFileLowerCaseMap.has(fileLower)) {
      matchedFilename = videoFileLowerCaseMap.get(fileLower);
    } else {
      // Check popular extensions
      for (const ext of extensions) {
        const fileWithExtLower = fileLower + ext;
        if (videoFileLowerCaseMap.has(fileWithExtLower)) {
          matchedFilename = videoFileLowerCaseMap.get(fileWithExtLower);
          break;
        }
      }
      
      // Fallback: match by basename
      if (!matchedFilename && videoFileBaseNameMap.has(fileLower)) {
        matchedFilename = videoFileBaseNameMap.get(fileLower);
      }
    }
    
    if (!matchedFilename) {
      errorsSummary.video_not_found++;
      invalidRows.push({
        ...row,
        error: `File "${row.video_file}" không tìm thấy trong folder`
      });
      continue;
    }
    
    validRows.push({
      ...row,
      user_id: systemUser.id,
      username: systemUser.username,
      video_path: path.join(videoFolder, matchedFilename),
      video_filename: matchedFilename
    });
  }
  
  return {
    valid: validRows,
    invalid: invalidRows,
    summary: {
      total: rows.length,
      valid: validRows.length,
      invalid: invalidRows.length,
      videoFilesInFolder: videoFilesSet.size,
      errors: errorsSummary
    }
  };
}

module.exports = {
  parseExcel,
  validateRows,
  parseProductLinks,
  extractShopeeIds
};