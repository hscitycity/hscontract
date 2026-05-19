# 화성 별별 계약 길잡이 — 프론트엔드

## GitHub Pages 배포 방법

1. GitHub 레포지토리 생성 (또는 기존 레포 사용)
2. `/frontend` 폴더 내용을 레포 루트 또는 `docs/` 폴더에 push
3. **Settings > Pages > Source** 를 "Deploy from a branch" 선택
4. Branch: `main`, 폴더: `/ (root)` 또는 `/docs` 선택 후 Save
5. 약 1~2분 후 `https://{username}.github.io/{repo-name}` 에서 확인

## 백엔드 URL 변경 방법

`index.html` 상단 인라인 스크립트의 Railway URL을 실제 주소로 교체하세요.

```js
const API_BASE = (location.hostname === 'localhost' || ...)
  ? 'http://localhost:4000'
  : 'https://your-backend.railway.app'; // ← 여기를 실제 URL로 교체
```

## 로컬 개발

```bash
# 프로젝트 루트에서
npm run dev:frontend  # http://localhost:3000
npm run dev:backend   # http://localhost:4000
```
