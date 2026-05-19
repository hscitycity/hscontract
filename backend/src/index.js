const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'hwaseong-contract-guide-api' });
});

// 계약 절차 안내 API
app.get('/api/procedures', (req, res) => {
  res.json({
    message: '계약 절차 목록 API — 구현 예정',
    data: []
  });
});

app.listen(PORT, () => {
  console.log(`[backend] API 서버 실행 중: http://localhost:${PORT}`);
});
