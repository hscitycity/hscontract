// 배포 후 아래 Railway URL을 실제 백엔드 주소로 교체하세요.
window.APP_CONFIG = {
  API_BASE_URL: (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:')
    ? 'http://localhost:4000'
    : 'https://hscontract-production.up.railway.app' // ← 실제 URL로 교체
};
