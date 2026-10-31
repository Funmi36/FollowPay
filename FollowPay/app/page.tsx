import { auth } from "@/auth";
import PayFollow from "@/components/PayFollow";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <PayFollow user={session.user} />;
}
