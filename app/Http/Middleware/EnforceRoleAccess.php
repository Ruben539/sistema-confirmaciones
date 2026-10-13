<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Runs after auth:sanctum on every panel / app route:
 * - Deactivated users are rejected (their old sessions and tokens stop working right away).
 * - Hostesses (anfitrionas) can only call the routes of their job: guest list, door check-in,
 *   table change, express add and guest history. Everything else (including any route added
 *   in the future) answers 403, so a new role never gets full access by accident.
 *   Which events they can touch is checked in each controller with User::canAccessEvent().
 */
class EnforceRoleAccess
{
    private const HOSTESS_ALLOWED = [
        'GET api/event',
        'GET api/events/{eventId}/guests',
        'POST api/events/{eventId}/guests',
        'PUT api/guests/{id}',
        'GET api/guests/{id}/activity',
        'POST api/check-in/scan',
        'POST api/check-in/{token}',
        'GET api/events/{eventId}/tables',
        // Download the mobile app
        'GET api/app-releases',
        'GET api/app-releases/{id}/download',
        'POST api/app-releases/seen',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->is_active === false) {
            $token = $user->currentAccessToken();
            if ($token instanceof \Laravel\Sanctum\PersonalAccessToken) {
                $token->delete(); // app token; web sessions are simply rejected on every request
            }
            return response()->json(['message' => 'Tu usuario fue desactivado. Consultá con quien te dio acceso.'], 401);
        }

        if ($user && $user->isHostess()) {
            $route = $request->method() . ' ' . $request->route()?->uri();
            if (!in_array($route, self::HOSTESS_ALLOWED, true)) {
                return response()->json(['message' => 'Tu usuario de anfitriona no tiene acceso a esta función.'], 403);
            }
        }

        return $next($request);
    }
}
