import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="mx-auto max-w-lg flex-1 p-10 text-center">
      <p className="text-sm font-semibold text-red-700">403</p>
      <h1 className="mt-2 text-2xl font-semibold">You don&apos;t have access to this page</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your role lacks the permission this page needs. The attempt was recorded in the audit log.</p>
      <div className="mt-6 flex justify-center gap-4 text-sm">
        <Link href="/" className="text-blue-700 hover:underline">
          Go home
        </Link>
        <Link href="/sign-in" className="text-blue-700 hover:underline">
          Switch user
        </Link>
      </div>
    </div>
  );
}
