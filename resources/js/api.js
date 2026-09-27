/**
 * Centralized API fetch helper that enforces Accept: application/json,
 * includes CSRF tokens, and handles non-JSON responses safely without throwing SyntaxError.
 */
export async function apiFetch(url, options = {}) {
    const defaultHeaders = {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    if (options.body && typeof options.body === 'string' && !options.headers?.['Content-Type']) {
        defaultHeaders['Content-Type'] = 'application/json';
    }

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (csrfToken) {
        defaultHeaders['X-CSRF-TOKEN'] = csrfToken;
    }

    const mergedHeaders = { ...defaultHeaders, ...options.headers };

    try {
        const res = await fetch(url, {
            ...options,
            headers: mergedHeaders,
        });

        const contentType = res.headers.get('content-type') || '';
        let json = null;
        if (contentType.includes('application/json')) {
            try {
                json = await res.json();
            } catch (e) {
                console.warn(`[apiFetch] Failed to parse JSON response from ${url}:`, e);
            }
        }

        return {
            ok: res.ok,
            status: res.status,
            statusText: res.statusText,
            json,
            res,
        };
    } catch (err) {
        console.error(`[apiFetch] Network/fetch error for ${url}:`, err);
        return {
            ok: false,
            status: 0,
            statusText: err.message || 'Network error',
            json: null,
            res: null,
        };
    }
}
