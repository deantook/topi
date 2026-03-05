import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { setToken } from "@/lib/auth";

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setToken(token);
    }
    navigate("/", { replace: true });
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">登录中...</p>
    </div>
  );
}
