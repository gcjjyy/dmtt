import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  layout("routes/main-layout.tsx", [
    index("routes/home.tsx"),
    route("welcome", "routes/welcome.tsx"),
    route("short-practice", "routes/short-practice.tsx"),
    route("long-practice", "routes/long-practice/index.tsx"),
    route("long-practice/:id", "routes/long-practice/$id.tsx"),
    route("venice", "routes/venice.tsx"),
    route("rankings/:type", "routes/rankings/$type.tsx"),
    route("settings", "routes/settings.tsx"),
    route("help", "routes/help.tsx"),
  ]),
  route("api/practice/start", "routes/api/practice.start.ts"),
  route("api/score/submit", "routes/api/score.submit.ts"),
] satisfies RouteConfig;
