import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getSession()) redirect("/companies");
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold">AgenticCRM</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Sign in to your account</p>
        </div>
        <LoginForm next={next} />
        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          Seeded demo login: <code>admin@agenticcrm.test</code> / <code>password123</code>
        </p>
      </div>
    </main>
  );
}
