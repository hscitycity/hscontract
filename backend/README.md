# 화성시 계약 업무 길잡이 — Backend API

## 로컬 개발

```bash
# 의존성 설치 (better-sqlite3 포함)
npm install

# 개발 서버 실행 (SQLite, nodemon 핫리로드)
npm run dev
```

로컬에서는 `data/hwaseong.db` 파일에 SQLite로 데이터를 저장합니다.

---

## Railway 배포 방법

### 1단계 — Railway 프로젝트 생성

1. [railway.app](https://railway.app) 접속 → **New Project**
2. **Deploy from GitHub repo** 선택 → 이 레포 연결
3. **Root Directory** 를 `/backend` 로 설정

### 2단계 — PostgreSQL 추가

Railway 프로젝트 대시보드 → **+ Add Service** → **Database** → **PostgreSQL**  
생성 후 `DATABASE_URL` 환경변수가 자동으로 백엔드 서비스에 연결됩니다.

### 3단계 — 환경변수 설정

Railway 서비스 → **Variables** 탭에서 아래 값 입력:

| 변수 | 값 | 설명 |
|------|----|------|
| `NODE_ENV` | `production` | DB를 PostgreSQL로 전환 |
| `JWT_SECRET` | (랜덤 긴 문자열) | JWT 서명 키 |
| `ADMIN_USERNAME` | `admin` | 관리자 아이디 |
| `ADMIN_PASSWORD` | (강한 비밀번호) | 관리자 비밀번호 |
| `CORS_ORIGIN` | `https://{username}.github.io` | 프론트엔드 도메인 |
| `DATABASE_URL` | (PostgreSQL 자동 주입) | Railway가 자동 설정 |

### 4단계 — 배포 확인

```
https://{your-service}.railway.app/health
```
→ `{ "status": "ok", "env": "production" }` 응답 확인

### 5단계 — 프론트엔드 URL 업데이트

`frontend/index.html` 상단의 `API_BASE` 를 Railway URL로 교체:

```js
: 'https://{your-service}.railway.app'
```

---

## API 엔드포인트

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/health` | - | 서버 상태 |
| POST | `/api/auth/login` | - | JWT 발급 |
| GET/PUT/DELETE | `/api/content` | - / - / - | 편집 콘텐츠 |
| PUT | `/api/content/:ekey` | ✅ | 개별 키 수정 |
| GET | `/api/docs` | - | 서류 목록 |
| POST/DELETE | `/api/docs/custom` | - | 커스텀 서류 교체 |
| POST/DELETE | `/api/docs/item` | ✅ | 개별 서류 관리 |
| GET/POST/DELETE | `/api/alerts` | - | 주의사항 |
| POST/DELETE | `/api/alerts/item` | ✅ | 개별 주의사항 관리 |
| POST | `/api/logs` | - | 접속 기록 |
| GET | `/api/stats` | ✅ | 접속 통계 |

---

## DB 구조 (PostgreSQL / SQLite 공용)

```
content_entries  — data-ekey 편집 내용
custom_docs      — 기관별 추가 서류
removed_docs     — 숨긴 기본 서류
alerts           — 사용자 추가 주의사항
access_logs      — 페이지 접속 기록
```
