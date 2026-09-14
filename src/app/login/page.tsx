import { AuthForm } from "@/components/auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return <AuthForm mode="login" error={(await searchParams).error} />;
}
