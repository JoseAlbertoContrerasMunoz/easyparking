import { login, signup } from './actions'

export default async function LoginPage(props: {
  searchParams?: Promise<{ error?: string; message?: string }>
}) {
  const searchParams = await props.searchParams;
  const error = searchParams?.error
  const message = searchParams?.message

  const errorText =
    error === 'missing-login-fields'
      ? 'Ingresa tu correo y contraseña.'
      : error === 'missing-signup-fields'
        ? 'Ingresa nombre completo, correo y contraseña para crear tu cuenta.'
        : error

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="easy-parking-panel w-full max-w-4xl rounded-[32px] p-6 sm:p-8">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Easy Parking
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Accede a tu cuenta</h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Inicia sesión con tu correo y contraseña, o crea una cuenta nueva con tu nombre.
          </p>
        </div>

        {error ? (
          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Error: {errorText}
          </p>
        ) : null}

        {message ? (
          <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {message}
          </p>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <form className="space-y-4 rounded-[24px] border border-[var(--border)] bg-white/70 p-5">
            <div>
              <h2 className="text-lg font-semibold">Iniciar sesión</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Solo necesitas tu correo y contraseña.</p>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--foreground)]" htmlFor="login-email">
              Correo
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="easy-parking-focus rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                placeholder="tu@correo.com"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--foreground)]" htmlFor="login-password">
              Contraseña
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="easy-parking-focus rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                placeholder="••••••••"
              />
            </label>

            <button
              formAction={login}
              className="easy-parking-focus inline-flex w-full items-center justify-center rounded-2xl bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--background)] transition hover:opacity-95"
            >
              Iniciar sesión
            </button>
          </form>

          <form className="space-y-4 rounded-[24px] border border-[var(--border)] bg-white/70 p-5">
            <div>
              <h2 className="text-lg font-semibold">Crear cuenta</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Tu nombre se guarda en el perfil de Supabase.</p>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--foreground)]" htmlFor="signup-full-name">
              Nombre completo
              <input
                id="signup-full-name"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                className="easy-parking-focus rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                placeholder="Juan Pérez"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--foreground)]" htmlFor="signup-email">
              Correo
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="easy-parking-focus rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                placeholder="tu@correo.com"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--foreground)]" htmlFor="signup-password">
              Contraseña
              <input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="easy-parking-focus rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                placeholder="••••••••"
              />
            </label>

            <button
              formAction={signup}
              className="easy-parking-focus inline-flex w-full items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold transition hover:bg-white/90"
            >
              Crear cuenta
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
