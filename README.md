# 도박 타자교사 (DMTT)

MS-DOS 시대의 타자연습 프로그램을 웹으로 재현한 프로젝트입니다.

## 주요 기능

- 🎯 **단문 연습**: 짧은 속담으로 빠른 타자 연습
- 📖 **장문 연습**: 긴 텍스트로 지속적인 타이핑 능력 향상
- 🎮 **베네치아 게임**: 떨어지는 단어를 입력하는 아케이드 스타일 게임
- 🏆 **랭킹 시스템**: 모드별 상위 랭커 확인
- 🌐 **한/영 지원**: 한국어와 영어 콘텐츠 제공
- 📊 **실시간 통계**: CPM, WPM, 정확도 실시간 계산
- 🎨 **MS-DOS 스타일**: 레트로 UI/UX 재현

## 기술 스택

- **React Router v7**: SSR 지원 라우팅
- **React 19** + **TypeScript**: 타입 안전성
- **Tailwind CSS v4**: 스타일링
- **PostgreSQL**: 점수 및 랭킹 저장
- **Vite v7**: 빌드 도구

## 시작하기

### 환경 변수 설정

`.env` 파일을 생성하고 PostgreSQL 연결 정보를 입력하세요:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/dmtt
```

### 데이터베이스 설정

```sql
-- scores 테이블 생성 (월별 랭킹 지원)
CREATE TABLE scores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'short', 'long', 'venice'
  score INT NOT NULL,
  extra JSONB,         -- {accuracy, cpm, level, ...}
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  year INT NOT NULL,   -- 기록 년도
  month INT NOT NULL,  -- 기록 월
  UNIQUE(name, type, year, month)
);

-- 인덱스 생성
CREATE INDEX idx_scores_type_score_desc ON scores (type, score DESC);
CREATE INDEX idx_scores_year_month ON scores (year, month);

-- upsert 함수 (현재 월 기준, 새 점수가 더 높을 때만 업데이트)
CREATE OR REPLACE FUNCTION upsert_score(
  p_name TEXT,
  p_type TEXT,
  p_score INT,
  p_extra JSONB
) RETURNS VOID AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_month INTEGER := EXTRACT(MONTH FROM NOW())::INTEGER;
BEGIN
  INSERT INTO scores (name, type, score, extra, created_at, year, month)
  VALUES (p_name, p_type, p_score, p_extra, NOW(), v_year, v_month)
  ON CONFLICT (name, type, year, month)
  DO UPDATE SET
    score = EXCLUDED.score,
    extra = EXCLUDED.extra,
    created_at = EXCLUDED.created_at
  WHERE EXCLUDED.score > scores.score;
END;
$$ LANGUAGE plpgsql;
```

> **기존 DB 마이그레이션**: `migrations/001_add_year_month.sql` 파일을 실행하세요.

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

### 타입 체크

```bash
npm run typecheck
```

### 프로덕션 빌드

```bash
npm run build
npm run start
```

## 프로젝트 구조

```
dmtt/
├── app/
│   ├── routes/              # 라우트 파일
│   │   ├── home.tsx         # 홈 화면
│   │   ├── short-practice.tsx
│   │   ├── long-practice/
│   │   ├── venice.tsx       # 베네치아 게임
│   │   ├── rankings/        # 랭킹 페이지
│   │   └── api/             # API 엔드포인트
│   ├── lib/                 # 유틸리티
│   │   ├── typing-engine.ts # 타이핑 통계 계산 (한글 자모 분해)
│   │   ├── db.server.ts     # DB 연결
│   │   ├── session.server.ts
│   │   └── rate-limit.server.ts
│   ├── contexts/            # React Context
│   │   ├── LanguageContext.tsx
│   │   └── GameStatusContext.tsx
│   └── components/          # 재사용 컴포넌트
├── public/                  # 정적 파일
│   ├── PROVERB.KOR          # 한국어 속담
│   ├── PROVERB.ENG          # 영어 속담
│   ├── kor01.txt ~ kor10.txt # 한국어 장문
│   ├── ALICE.TXE, ANT.TXE 등 # 영어 장문
│   └── WORD.KOR, WORD.ENG   # 게임용 단어
└── CLAUDE.md                # 개발 가이드

```

## 핵심 기능 설명

### 한글 타이핑 계산

한글은 자음과 모음을 조합하여 입력하므로, 정확한 타수 계산을 위해 자모 단위로 분해합니다:

- **종성 있음** (예: "한"): 3타 (ㅎ + ㅏ + ㄴ)
- **종성 없음** (예: "하"): 2타 (ㅎ + ㅏ)
- **영문/기타**: 1타

### 점수 계산

- **단문/장문 연습**: `점수 = CPM` (분당 타수)
- **베네치아 게임**: `점수 = 정확도 × CPM`

### 등급

```
S: 8000점 이상 + 정확도 95% 이상
A: 6000점 이상 + 정확도 90% 이상
B: 4000점 이상 + 정확도 85% 이상
C: 2000점 이상 + 정확도 80% 이상
D: 1000점 이상 + 정확도 70% 이상
F: 그 이하
```

### 보안 및 검증

- **세션 토큰**: 연습 시작 시 발급, 1시간 유효
- **서버 검증**: 클라이언트에서 계산한 점수를 서버에서 재계산하여 1% 오차 이내 확인
- **Rate Limiting**:
  - IP별: 10회/분
  - 이름별: 50회/시간
  - 세션 생성: 3회/분

## 베네치아 게임 규칙

1. 화면 위에서 단어가 떨어집니다
2. 단어를 정확히 입력하고 스페이스바를 누르면 사라집니다
3. 바닥에 닿으면 라이프 1개 감소
4. 라이프를 모두 잃으면 게임 오버
5. 일정 점수마다 단계 상승 (속도 증가)
6. **바이러스 단어** (빨간색): 입력하면 지뢰로 변하여 화면에 고정
7. **지뢰**: 다른 단어와 충돌 시 폭발 (라이프 감소)

## 콘텐츠 추가

`/public/` 폴더에 파일을 추가하면 자동으로 인식됩니다:

- **단문 연습**: `PROVERB.KOR`, `PROVERB.ENG`
- **장문 연습**: `kor01.txt ~ kor10.txt`, `ALICE.TXE` 등
- **게임 단어**: `WORD.KOR`, `WORD.ENG`

## 배포

### Docker

```bash
docker build -t dmtt .
docker run -p 3000:3000 -e DATABASE_URL=your_db_url dmtt
```

### 일반 배포

```bash
npm run build
node build/server/index.js
```

## 라이선스

MIT

## 크레딧

- 원작: 도스박물관 - 도스시대의 추억을 간직하는 곳
- 웹 재구현: gcjjyy@gmail.com
- (C) 2025 QuickBASIC

---

MS-DOS의 감성을 그대로, 웹의 편리함으로.
