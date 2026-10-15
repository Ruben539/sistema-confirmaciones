<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title') · {{ config('legal.brand') }}</title>
    <meta name="robots" content="index,follow">
    <style>
        :root { --bg: #fafaf9; --card: #ffffff; --text: #1c1917; --muted: #57534e; --line: #e7e5e4; --accent: #e11d48; }
        @media (prefers-color-scheme: dark) {
            :root { --bg: #0c0a09; --card: #1c1917; --text: #fafaf9; --muted: #a8a29e; --line: #292524; --accent: #fb7185; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
        main { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
        .card { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 28px 24px; }
        .brand { font-weight: 800; color: var(--accent); letter-spacing: .02em; font-size: 14px; text-transform: uppercase; }
        h1 { font-size: 28px; line-height: 1.2; margin: 8px 0 4px; }
        h2 { font-size: 18px; margin: 28px 0 8px; }
        p, li { color: var(--text); }
        .muted { color: var(--muted); font-size: 14px; }
        ul { padding-left: 20px; }
        a { color: var(--accent); }
        nav { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 24px; font-size: 14px; }
        .box { border-left: 4px solid var(--accent); padding: 8px 16px; background: color-mix(in srgb, var(--accent) 7%, transparent); border-radius: 8px; }
    </style>
</head>
<body>
<main>
    <div class="card">
        <div class="brand">{{ config('legal.brand') }}</div>
        <h1>@yield('title')</h1>
        <p class="muted">Última actualización: {{ config('legal.updated_at') }}</p>
        @yield('content')

        <h2>Contacto</h2>
        <p>
            Responsable: {{ config('legal.owner') }} ({{ config('legal.country') }}).
            @if (config('legal.email'))
                Correo: <a href="mailto:{{ config('legal.email') }}">{{ config('legal.email') }}</a>.
            @endif
            @if (config('legal.whatsapp'))
                WhatsApp: {{ config('legal.whatsapp') }}.
            @endif
        </p>
    </div>
    <nav>
        <a href="/privacidad">Política de privacidad</a>
        <a href="/terminos">Condiciones del servicio</a>
        <a href="/eliminar-datos">Eliminación de datos</a>
    </nav>
</main>
</body>
</html>
