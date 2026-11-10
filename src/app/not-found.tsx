import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg flex-1 p-10 text-center">
      <p className="text-sm font-semibold text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <Link href="/" className="mt-6 inline-block text-sm text-blue-700 hover:underline">
        Go home
      </Link>
    </div>
  );
}
