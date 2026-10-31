import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in – PayFollow",
  description: "Sign in to access your unpaid invoice follow-up workspace.",
};

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <Suspense fallback={<div className="login-card"><div className="login-desc">Loading...</div></div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

