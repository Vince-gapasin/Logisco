import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <SearchX className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-black"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
