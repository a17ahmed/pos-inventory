const os = require('os');

// Auto-detect local IP address for development
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const isDev = process.env.NODE_ENV !== 'production';
const localIP = isDev ? getLocalIP() : null;

if (isDev) {
  console.log(`[app.config.js] Development mode - Detected IP: ${localIP}`);
}

module.exports = ({ config }) => {
  // In production, API_URL env var MUST be set to your actual API domain (with https)
  const apiUrl = process.env.API_URL || (isDev ? `http://${localIP}:3000` : undefined);

  if (!apiUrl) {
    console.error('[app.config.js] ERROR: API_URL environment variable is required in production');
  }

  return {
    ...config,
    extra: {
      ...config.extra,
      API_BASE_URL: apiUrl,
    },
  };
};
