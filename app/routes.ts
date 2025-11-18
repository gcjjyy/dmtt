import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("welcome", "routes/welcome.tsx"),
  route("short-practice", "routes/short-practice.tsx"),
  route("long-practice", "routes/long-practice/index.tsx"),
  route("long-practice/:id", "routes/long-practice/$id.tsx"),
  route("venice", "routes/venice.tsx"),
  route("rankings/:type", "routes/rankings/$type.tsx"),
  route("settings", "routes/settings.tsx"),
  route("api/practice/start", "routes/api/practice.start.ts"),
  route("api/score/submit", "routes/api/score.submit.ts"),
] satisfies RouteConfig;
