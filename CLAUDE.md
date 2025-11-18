# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DMTT is a bilingual (Korean/English) typing practice web application built with React Router v7, TypeScript, and PostgreSQL. It features three practice modes (short sentences, long texts, Venice game) with real-time metrics, server-validated scoring, and rankings.

## Development Commands

```bash
# Start development server with HMR at http://localhost:5173
npm run dev

# Type checking (generates route types first, then runs tsc)
npm run typecheck

# Production build
npm run build

# Start production server (serves ./build/server/index.js)
npm run start
```

## Technology Stack

- **React Router v7**: SSR-enabled routing with file-based conventions
- **React 19** + **TypeScript**: Strict mode, ES2022 target
- **Tailwind CSS v4**: Via Vite plugin (no config file)
- **PostgreSQL**: Direct queries via `postgres` library (minimal Drizzle usage)
- **Vite v7**: Build tool with HMR

## Architecture

### Routing System (`app/routes.ts`)

Routes defined using React Router v7 configuration with file-based convention:

```typescript
export default [
  index("routes/home.tsx"),
  route("welcome", "routes/welcome.tsx"),
  route("short-practice", "routes/short-practice.tsx"),
  route("long-practice/:id", "routes/long-practice/$id.tsx"),
  route("api/practice/start", "routes/api/practice.start.ts"),
  route("api/score/submit", "routes/api/score.submit.ts"),
  // ...
] satisfies RouteConfig;
```

**Important**: API routes must be registered in `routes.ts` to be accessible.

### Route Types

- Type-safe route typing via auto-generated `+types` files in `.react-router/types/`
- Run `npm run typecheck` to regenerate route types
- Import as: `import type { Route } from "./+types/filename";`

### Path Aliases

The `~/*` alias maps to `./app/*` (configured in tsconfig.json):
```typescript
import { calculateTypingStats } from "~/lib/typing-engine";
```

## Core Domain Logic: Typing Engine

**Location**: `app/lib/typing-engine.ts`

### Korean Character Handling (Critical)

Korean characters are decomposed into jamo components for accurate keystroke counting:

- **Unicode range**: `0xAC00 ~ 0xD7A3`
- **Keystroke calculation**:
  - Korean with 종성 (final consonant): **3 keystrokes**
  - Korean without 종성: **2 keystrokes**
  - English/other: **1 keystroke**

```typescript
// Example: "한" = 초성(ㅎ) + 중성(ㅏ) + 종성(ㄴ) = 3 keystrokes
// Example: "하" = 초성(ㅎ) + 중성(ㅏ) = 2 keystrokes
```

This means **all metrics (CPM, WPM, accuracy) are keystroke-based, not character-based**.

### Scoring Algorithm

```typescript
interface TypingStats {
  totalChars: number;      // Characters typed
  correctChars: number;    // Correct keystrokes (not characters!)
  accuracy: number;        // 0-100
  timeElapsed: number;     // Seconds
  cpm: number;            // Characters per minute (correct keystrokes only)
  wpm: number;            // Words per minute (5 chars = 1 word)
  score: number;          // Mode-dependent
}
```

**Score calculation**:
- Short/Long practice: `score = CPM` (speed-focused)
- Venice game: `score = accuracy × CPM` (balanced)

**Grading**:
```
S: score >= 8000 && accuracy >= 95%
A: score >= 6000 && accuracy >= 90%
B: score >= 4000 && accuracy >= 85%
C: score >= 2000 && accuracy >= 80%
D: score >= 1000 && accuracy >= 70%
F: below threshold
```

### Key Functions

- `calculateTypingStats(originalText, typedText, timeInSeconds, mode)`: Main calculation
- `calculateCorrectKeystrokes(originalText, typedText)`: Korean-aware keystroke counting
- `compareChars(original, typed)`: Partial credit for Korean characters
- `getTypingGrade(accuracy, cpm)`: Letter grade assignment

## API Security & Validation

### Session Flow

1. **Start Practice**: `POST /api/practice/start` with `{type: "short"|"long"|"venice"}`
   - Returns: `{token: uuid, expiresAt: timestamp}`
   - Session expires in 1 hour
   - In-memory storage (not persisted to DB)

2. **Submit Score**: `POST /api/score/submit` with full typing data
   - Multi-layer validation (see below)
   - Only saves if score > previous score for that user+type

### Validation Pipeline (8 Steps)

**Location**: `app/routes/api/score.submit.ts`

1. Validate session token (exists, not expired)
2. Check submission limits (max 100/session, min 2s between)
3. Validate name (1-50 chars, Korean/English/numbers only)
4. IP rate limit (10 req/min)
5. Name rate limit (50 req/hour)
6. Validate text content (1-10k chars)
7. **Server-side score recalculation** with 1% tolerance
8. Save via PostgreSQL `upsert_score()` function

**Critical**: Server recalculates all metrics to prevent cheating. Client scores must match within 1% tolerance.

### Rate Limiting

**Location**: `app/lib/rate-limit.server.ts`

| Type | Limit | Window |
|------|-------|--------|
| IP requests | 10/min | 60s |
| Name submissions | 50/hour | 3600s |
| Session creation | 3/min per IP | 60s |

In-memory storage with automatic cleanup every 5 minutes.

## Database

**Connection**: `app/lib/db.server.ts`

Uses `postgres` library with connection string from `DATABASE_URL` environment variable.

### Schema

**scores table**:
```sql
CREATE TABLE scores (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50),
  type VARCHAR(20),  -- 'short', 'long', 'venice'
  score INT,
  extra JSONB,       -- {accuracy, cpm, sentence?}
  created_at TIMESTAMP,
  UNIQUE(name, type)
);
```

**PostgreSQL function** (must exist):
```sql
upsert_score(name, type, score, extra)
-- Updates only if new score > old score
```

## Content Loading

**Location**: `app/lib/data-loader.server.ts`

All practice content loaded from static files in `/public/`:

**Short practice (proverbs)**:
- `PROVERB.KOR`, `PROVERB.ENG`

**Long practice**:
- Korean: `kor01.txt` - `kor10.txt`
- English: `ALICE.TXE`, `ANT.TXE`, `MOUSE.TXE`, `PETERPAN.TXE`, `PIG.TXE`, `TAILOR.TXE`

**Venice game (words)**:
- `WORD.KOR`, `WORD.ENG`

Files are loaded on-demand (no caching). To add content, simply add files to `/public/` with proper naming.

## Language/Localization

**Location**: `app/contexts/LanguageContext.tsx`

Simple pattern-based i18n:
```typescript
const { t, language, setLanguage } = useLanguage();
// Usage: t("한글 텍스트", "English text")
```

Language preference stored in localStorage (`typing-language`), defaults to Korean.

## User Authentication Flow

**Welcome page enforcement**: `app/root.tsx` checks for `typing-practice-username` in localStorage:
- If not set → redirect to `/welcome`
- If set → allow navigation
- Username validation: 1-50 chars, Korean/English/numbers only

This is a simple client-side persistence mechanism, not a security feature.

## Common Patterns

### Real-time Metrics

Short and long practice modes show live CPM updates. Pattern:
```typescript
// Use refs to avoid stale closures in intervals
const typedTextRef = useRef(typedText);
useEffect(() => {
  typedTextRef.current = typedText;
}, [typedText]);

useEffect(() => {
  const interval = setInterval(() => {
    // Use ref value, not state
    const cpm = calculateCPM(typedTextRef.current, elapsed);
    setCurrentCPM(cpm);
  }, 100);
  return () => clearInterval(interval);
}, []);
```

### Hydration Issues

When using localStorage, avoid SSR hydration mismatches:
```typescript
// Bad: const username = localStorage.getItem("key");
// Good:
const [username, setUsername] = useState("");
useEffect(() => {
  setUsername(localStorage.getItem("key") || "");
}, []);
```

### Server-Only Files

Files ending in `.server.ts` are automatically excluded from client bundles by React Router. Use for:
- Database queries (`db.server.ts`)
- Session management (`session.server.ts`)
- Rate limiting (`rate-limit.server.ts`)
- Data loading (`data-loader.server.ts`)

## Key Technical Decisions

1. **Keystroke-based metrics**: Unlike typical typing apps that count characters, this app counts actual keystrokes needed for Korean input
2. **In-memory sessions**: Fast, but sessions lost on server restart (acceptable for practice app)
3. **File-based content**: Easy to update without deployment, but no versioning/CMS
4. **Server-side validation**: Prevents score manipulation, requires exact recalculation
5. **No user accounts**: localStorage-based identity for simplicity
6. **PostgreSQL UPSERT**: Atomic high-score updates without race conditions

## Debugging Tips

- Check `npm run typecheck` for route type generation issues
- API 404s → ensure route is registered in `app/routes.ts`
- Hydration errors → check for localStorage/client-only code in render
- CPM/accuracy mismatches → verify Korean character decomposition logic
- Score submission failures → check server logs for validation errors
