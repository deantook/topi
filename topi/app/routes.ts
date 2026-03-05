import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  route("auth/callback", "routes/auth.callback.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  layout("routes/layout.tsx", [
    index("routes/all.tsx"),
    route("today", "routes/today.tsx"),
    route("tomorrow", "routes/tomorrow.tsx"),
    route("recent-seven", "routes/recent-seven.tsx"),
    route("inbox", "routes/inbox.tsx"),
    route("list/:listId", "routes/list.$listId.tsx"),
    route("completed", "routes/completed.tsx"),
    route("abandoned", "routes/abandoned.tsx"),
    route("trash", "routes/trash.tsx"),
    route("dashboard", "routes/dashboard.tsx"),
    route("docs", "routes/docs.tsx"),
    route("settings", "routes/settings.tsx"),
  ]),
] satisfies RouteConfig;
