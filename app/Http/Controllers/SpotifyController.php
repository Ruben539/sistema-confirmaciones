<?php

namespace App\Http\Controllers;

use App\Services\SpotifyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class SpotifyController extends Controller
{
    protected SpotifyService $spotifyService;

    public function __construct(SpotifyService $spotifyService)
    {
        $this->spotifyService = $spotifyService;
    }

    /**
     * Resolve metadata and embed info for any Spotify URL or URI.
     */
    public function resolve(Request $request): JsonResponse
    {
        $url = $request->query('url');
        if (empty($url)) {
            return response()->json([
                'success' => false,
                'message' => 'El parámetro url es obligatorio.'
            ], 422);
        }

        $metadata = $this->spotifyService->resolve($url);
        if (!$metadata) {
            return response()->json([
                'success' => false,
                'message' => 'No se pudo resolver el enlace de Spotify provisto.'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $metadata
        ]);
    }

    /**
     * Search songs on Spotify catalog for DJ suggestions.
     */
    public function search(Request $request): JsonResponse
    {
        $query = $request->query('q', '');
        if (empty(trim($query))) {
            return response()->json([
                'success' => true,
                'results' => []
            ]);
        }

        $type = $request->query('type', 'track');
        $limit = (int) $request->query('limit', 6);

        $results = $this->spotifyService->search($query, $type, $limit);

        return response()->json([
            'success' => true,
            'query' => $query,
            'results' => $results
        ]);
    }
}
