# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Router v7 application with server-side rendering (SSR) enabled by default. The project uses TypeScript, Vite for building, and Tailwind CSS v4 for styling.

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

## Architecture

### Routing System

Routes are defined in `app/routes.ts` using the React Router v7 configuration format:
- Export a `RouteConfig` array from `app/routes.ts`
- Routes use the file-based convention with files in `app/routes/`
- Route files can export `meta`, `loader`, `action`, and default component
- Type-safe route typing via generated `+types` files (e.g., `./+types/home`)

Example route structure:
```typescript
// app/routes.ts
import { type RouteConfig, index } from "@react-router/dev/routes";
export default [index("routes/home.tsx")] satisfies RouteConfig;
```

### Root Layout

`app/root.tsx` provides the base HTML structure:
- `Layout` component wraps the entire app with `<html>`, `<head>`, and `<body>`
- `links` function for adding external resources (fonts, stylesheets)
- Default `App` component renders `<Outlet />` for child routes
- Global `ErrorBoundary` handles both route errors and uncaught exceptions

### Path Aliases

The `~/*` alias maps to `./app/*` (configured in tsconfig.json), allowing imports like:
```typescript
import { Welcome } from "~/welcome/welcome";
```

### Build Output

Production builds create:
- `build/client/` - Static assets for browser
- `build/server/` - Server-side rendering code

### Type Generation

Run `npm run typecheck` to:
1. Generate route types in `.react-router/types/` directory
2. Run TypeScript compiler for type checking

Types are auto-generated for routes in the `+types` convention.

## Configuration Files

- `react-router.config.ts` - React Router config (SSR enabled by default)
- `vite.config.ts` - Vite build configuration with plugins:
  - `@tailwindcss/vite` for Tailwind CSS v4
  - `@react-router/dev/vite` for React Router
  - `vite-tsconfig-paths` for path alias resolution
- `tsconfig.json` - TypeScript configuration with strict mode enabled

## Docker Deployment

Multi-stage Dockerfile optimized for production:
1. Install all dependencies
2. Install production dependencies only
3. Build the application
4. Final image with production deps and build output

```bash
docker build -t my-app .
docker run -p 3000:3000 my-app
```

## Key Dependencies

- React 19 with React Router v7
- Node server via `@react-router/node` and `@react-router/serve`
- Tailwind CSS v4 (configured via Vite plugin)
- TypeScript with strict mode
