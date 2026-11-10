// Global logger formatter with timestamp [HH:mm:ss]

function getTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `[${hours}:${minutes}:${seconds}]`;
}

if (!global._consoleTimestampPatched) {
  global._consoleTimestampPatched = true;

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  console.log = function(...args) {
    originalLog.call(console, getTimestamp(), ...args);
  };
  console.error = function(...args) {
    originalError.call(console, getTimestamp(), ...args);
  };
  console.warn = function(...args) {
    originalWarn.call(console, getTimestamp(), ...args);
  };
  console.info = function(...args) {
    originalInfo.call(console, getTimestamp(), ...args);
  };
}

module.exports = { getTimestamp };
