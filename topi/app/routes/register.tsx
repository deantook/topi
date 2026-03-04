import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
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

const registerSchema = z
  .object({
    username: z.string().min(1, "请输入用户名"),
    password: z.string().min(6, "密码至少 6 位"),
    confirmPassword: z.string().min(1, "请确认密码"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const navigate = useNavigate();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    try {
      const res = await fetch(`${getApiUrl()}/api/v1/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: values.username,
          password: values.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        form.setError("root", {
          message: (data?.message as string) ?? "注册失败，请稍后重试",
        });
        return;
      }

      // Option A: call login to get token and navigate to /
      const loginRes = await fetch(`${getApiUrl()}/api/v1/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: values.username,
          password: values.password,
        }),
      });

      const loginData = await loginRes.json();

      if (loginRes.ok && loginData?.data?.token) {
        setToken(loginData.data.token);
        navigate("/");
      } else {
        // Option B fallback: navigate to /login with success message
        navigate("/login?registered=1");
      }
    } catch {
      form.setError("root", { message: "网络错误，请稍后重试" });
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>注册</CardTitle>
          <CardDescription>创建您的账号</CardDescription>
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
                      <Input
                        placeholder="请输入用户名"
                        autoComplete="username"
                        {...field}
                      />
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
                        placeholder="请输入密码（至少 6 位）"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>确认密码</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="请再次输入密码"
                        autoComplete="new-password"
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
                {form.formState.isSubmitting ? "注册中..." : "注册"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link
            to="/login"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            已有账号？去登录
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
