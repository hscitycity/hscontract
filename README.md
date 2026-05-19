# 화성시 계약 업무 길잡이

> 사업담당자용 계약 절차 안내 시스템

---

## 프로젝트 구조

```
hwaseong-contract-guide/
├── frontend/       # 사용자 앱 (정적 HTML) — dev: 3000
├── backend/        # REST API (Node.js + Express) — dev: 4000
├── admin/          # 관리자 웹앱 (정적 HTML) — dev: 3001
├── render.yaml     # Render Blueprint 배포 설정
└── package.json
```

## 로컬 개발

```bash
# 의존성 설치
npm install --workspaces

# 각 서버 개별 실행
npm run dev:frontend   # http://localhost:3000
npm run dev:backend    # http://localhost:4000
npm run dev:admin      # http://localhost:3001
```

---

## 배포 (GitHub + Render)

### 1단계 — GitHub 저장소 생성 및 푸시

```bash
git init
git add .
git commit -m "chore: initial monorepo setup"
git remote add origin https://github.com/<YOUR_USERNAME>/hwaseong-contract-guide.git
git push -u origin main
```

### 2단계 — Render Blueprint 연결

1. [Render Dashboard](https://dashboard.render.com) → **New → Blueprint**
2. GitHub 저장소 연결
3. `render.yaml`을 자동 감지해 3개 서비스를 한 번에 생성

| 서비스 | 종류 | URL 예시 |
|--------|------|----------|
| `hwaseong-contract-api` | Web Service (Node) | `https://hwaseong-contract-api.onrender.com` |
| `hwaseong-contract-frontend` | Static Site | `https://hwaseong-contract-frontend.onrender.com` |
| `hwaseong-contract-admin` | Static Site | `https://hwaseong-contract-admin.onrender.com` |

### 3단계 — Admin API URL 업데이트

백엔드 배포 후 실제 URL을 `admin/config.js`에 반영하고 커밋:

```js
// admin/config.js
window.APP_CONFIG = {
  API_BASE_URL: 'https://hwaseong-contract-api.onrender.com'
};
```

### 자동 배포

GitHub `main` 브랜치에 푸시하면 Render가 자동으로 재배포합니다.

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 확인 |
| GET | `/api/procedures` | 계약 절차 목록 |
