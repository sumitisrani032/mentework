import { fetchApiHealth } from "@/lib/api";

export default async function Home() {
  const health = await fetchApiHealth();
  const isOnline = health !== null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-6 py-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Mentework</h1>
        <p className="mt-2 text-sm opacity-60">
          Next.js frontend and FastAPI backend, sharing one PostgreSQL database.
        </p>
      </header>

      <section className="rounded-xl border border-current/10 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">API</h2>
            <p className="mt-1 font-mono text-xs opacity-50">GET /api/v1/health</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-current/10 px-3 py-1 text-xs">
            <span
              aria-hidden
              className={`size-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-red-500"}`}
            />
            {isOnline ? "online" : "unreachable"}
          </span>
        </div>

        {health ? (
          <dl className="mt-4 flex gap-2 text-sm">
            <dt className="opacity-50">environment</dt>
            <dd className="font-mono">{health.environment}</dd>
          </dl>
        ) : (
          <p className="mt-4 text-sm opacity-60">
            Start the backend with <code className="font-mono">npm run dev:api</code>, or the whole
            stack with <code className="font-mono">npm run dev</code>.
          </p>
        )}
      </section>
    </main>
  );
}
