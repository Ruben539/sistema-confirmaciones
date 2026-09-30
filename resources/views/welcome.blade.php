<!DOCTYPE html>
<html lang="es">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title>Wedding Planner Pro | Confirmación de Asistencia</title>

        <!-- Google Fonts: Plus Jakarta Sans, Playfair Display (Luxury Serif) and Great Vibes (Calligraphy Script) -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">

        <!-- Theme Initialization to prevent flash -->
        <script>
            (function() {
                try {
                    var theme = localStorage.getItem('theme') || 'dark';
                    if (theme === 'dark') {
                        document.documentElement.classList.add('dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                    }
                } catch (e) {}
            })();
        </script>

        <!-- Vite Assets -->
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.jsx'])
    </head>
    <body class="bg-slate-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-white antialiased font-sans transition-colors duration-200">
        <!-- React Single Page Application Root -->
        <div id="app"></div>
    </body>
</html>
