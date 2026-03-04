import { Outlet, redirect } from "react-router";
import { AppLayout } from "@/components/app-layout";
import { getToken, getTokenFromRequest } from "@/lib/auth";

export async function loader({ request }: { request: Request }) {
  const token = typeof window !== "undefined" ? getToken() : getTokenFromRequest(request);
  if (!token) {
    throw redirect("/login");
  }
  return null;
}

export default function Layout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
