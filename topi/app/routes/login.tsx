import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/login";
import { z } from "zod/v3";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getApiUrl } from "@/lib/api";
import { setToken } from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(6, "密码至少 6 位"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function meta({}: Route.MetaArgs) {
  return [{ title: "待办清单" }];
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      const res = await fetch(`${getApiUrl()}/api/v1/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: values.username,
          password: values.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          form.setError("root", { message: "用户名或密码错误" });
        } else {
          form.setError("root", {
            message: (data?.message as string) ?? "登录失败，请稍后重试",
          });
        }
        return;
      }

      const token = data?.data?.token;
      if (token) {
        setToken(token);
        // 使用完整跳转确保 layout loader 能读取到 token
        window.location.href = redirect || "/";
      } else {
        form.setError("root", { message: "登录失败，请稍后重试" });
      }
    } catch {
      form.setError("root", { message: "网络错误，请稍后重试" });
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>登录</CardTitle>
          <CardDescription>输入您的账号密码登录</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {form.formState.errors.root && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用户名</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入用户名" autoComplete="username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密码</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="请输入密码"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "登录中..." : "登录"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link
            to={
              redirect === "/"
                ? "/register"
                : `/register?redirect=${encodeURIComponent(redirect)}`
            }
            className="text-sm text-muted-foreground hover:text-primary"
          >
            没有账号？去注册
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
