import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-100 p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-extrabold text-indigo-500 font-mono">404</h1>
        <h2 className="text-xl font-bold text-white">Page Not Found</h2>
        <p className="text-xs text-slate-400">
          The requested resource could not be found or you do not have permission to view it.
        </p>
        <div>
          <Link
            href="/dashboard"
            className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
