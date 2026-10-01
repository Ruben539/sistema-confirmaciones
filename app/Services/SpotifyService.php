<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class SpotifyService
{
    protected ?string $clientId;
    protected ?string $clientSecret;
    protected ?string $apiKey;

    public function __construct()
    {
        $this->clientId = config('services.spotify.client_id') 
            ?: env('SPOTIFY_CLIENT_ID', env('SPOTIFYCLIENTID'));
        $this->clientSecret = config('services.spotify.client_secret') 
            ?: env('SPOTIFY_CLIENT_SECRET', env('SPOTIFYCLIENTSECRET'));
        $this->apiKey = config('services.spotify.api_key') 
            ?: env('SPOTIFY_API_KEY', env('SPOTIFYAPIKEY'));
    }

    /**
     * Check if Spotify service is configured with valid credentials.
     */
    public function isConfigured(): bool
    {
        return !empty($this->clientId) && !empty($this->clientSecret);
    }

    /**
     * Obtain access token using Client Credentials Flow, cached for ~1 hour.
     */
    public function getAccessToken(): ?string
    {
        if (!$this->isConfigured()) {
            Log::warning('SpotifyService: Client credentials are not configured.');
            return null;
        }

        try {
            return Cache::remember('spotify_access_token', 3500, function () {
                $response = Http::asForm()
                    ->timeout(10)
                    ->post('https://accounts.spotify.com/api/token', [
                        'grant_type' => 'client_credentials',
                        'client_id' => $this->clientId,
                        'client_secret' => $this->clientSecret,
                    ]);

                if (!$response->successful()) {
                    Log::error('SpotifyService: Failed to retrieve token. ' . $response->body());
                    return null;
                }

                $data = $response->json();
                return $data['access_token'] ?? null;
            });
        } catch (\Throwable $e) {
            Log::error('SpotifyService Exception getting token: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Parse any Spotify URL or URI into type and ID.
     */
    public function parseSpotifyUrl(?string $url): ?array
    {
        if (empty($url)) {
            return null;
        }

        $url = trim($url);

        // URI format: spotify:track:id or spotify:playlist:id or spotify:album:id
        if (str_starts_with($url, 'spotify:')) {
            $parts = explode(':', $url);
            if (count($parts) >= 3) {
                return [
                    'type' => $parts[1],
                    'id' => $parts[2],
                    'uri' => "spotify:{$parts[1]}:{$parts[2]}",
                    'embed_url' => "https://open.spotify.com/embed/{$parts[1]}/{$parts[2]}",
                ];
            }
        }

        // Web URL format: open.spotify.com/(intl-xx/)?(track|playlist|album)/id
        if (preg_match('#(?:open\.spotify\.com/(?:[a-zA-Z\-]+/)?|spotify/)(track|playlist|album|artist)/([a-zA-Z0-9]+)#', $url, $matches)) {
            $type = $matches[1];
            $id = $matches[2];
            return [
                'type' => $type,
                'id' => $id,
                'uri' => "spotify:{$type}:{$id}",
                'embed_url' => "https://open.spotify.com/embed/{$type}/{$id}",
            ];
        }

        return null;
    }

    /**
     * Resolve metadata for a Spotify URL/URI (Track, Playlist, or Album).
     */
    public function resolve(string $url): ?array
    {
        $parsed = $this->parseSpotifyUrl($url);
        if (!$parsed) {
            return null;
        }

        $token = $this->getAccessToken();
        if (!$token) {
            // Fallback basic info if token fails
            return [
                'type' => $parsed['type'],
                'id' => $parsed['id'],
                'uri' => $parsed['uri'],
                'embed_url' => $parsed['embed_url'],
                'title' => ucfirst($parsed['type']) . ' de Spotify',
                'artist' => 'Spotify',
                'image' => null,
                'preview_url' => null,
            ];
        }

        $type = $parsed['type'];
        $id = $parsed['id'];

        try {
            $cacheKey = "spotify_meta_{$type}_{$id}";
            return Cache::remember($cacheKey, 86400, function () use ($token, $type, $id, $parsed) {
                $endpoint = match ($type) {
                    'track' => "https://api.spotify.com/v1/tracks/{$id}",
                    'playlist' => "https://api.spotify.com/v1/playlists/{$id}",
                    'album' => "https://api.spotify.com/v1/albums/{$id}",
                    default => null,
                };

                if (!$endpoint) {
                    return [
                        'type' => $type,
                        'id' => $id,
                        'uri' => $parsed['uri'],
                        'embed_url' => $parsed['embed_url'],
                    ];
                }

                $res = Http::withToken($token)
                    ->timeout(8)
                    ->get($endpoint);

                if (!$res->successful()) {
                    Log::warning("SpotifyService: Error fetching {$type} {$id}: " . $res->status());
                    return [
                        'type' => $type,
                        'id' => $id,
                        'uri' => $parsed['uri'],
                        'embed_url' => $parsed['embed_url'],
                        'title' => ucfirst($type),
                        'artist' => null,
                        'image' => null,
                    ];
                }

                $data = $res->json();

                if ($type === 'track') {
                    $artistNames = array_map(fn($a) => $a['name'] ?? '', $data['artists'] ?? []);
                    $image = $data['album']['images'][0]['url'] ?? null;

                    return [
                        'type' => 'track',
                        'id' => $id,
                        'uri' => $data['uri'] ?? $parsed['uri'],
                        'embed_url' => $parsed['embed_url'],
                        'external_url' => $data['external_urls']['spotify'] ?? "https://open.spotify.com/track/{$id}",
                        'title' => $data['name'] ?? 'Pista de Spotify',
                        'artist' => implode(', ', array_filter($artistNames)),
                        'album' => $data['album']['name'] ?? null,
                        'image' => $image,
                        'duration_ms' => $data['duration_ms'] ?? null,
                        'preview_url' => $data['preview_url'] ?? null,
                    ];
                }

                if ($type === 'playlist') {
                    $image = $data['images'][0]['url'] ?? null;
                    $ownerName = $data['owner']['display_name'] ?? 'Spotify';

                    return [
                        'type' => 'playlist',
                        'id' => $id,
                        'uri' => $data['uri'] ?? $parsed['uri'],
                        'embed_url' => $parsed['embed_url'],
                        'external_url' => $data['external_urls']['spotify'] ?? "https://open.spotify.com/playlist/{$id}",
                        'title' => $data['name'] ?? 'Playlist de la Fiesta',
                        'artist' => "Por {$ownerName}",
                        'description' => $data['description'] ?? null,
                        'total_tracks' => $data['tracks']['total'] ?? null,
                        'image' => $image,
                    ];
                }

                if ($type === 'album') {
                    $artistNames = array_map(fn($a) => $a['name'] ?? '', $data['artists'] ?? []);
                    $image = $data['images'][0]['url'] ?? null;

                    return [
                        'type' => 'album',
                        'id' => $id,
                        'uri' => $data['uri'] ?? $parsed['uri'],
                        'embed_url' => $parsed['embed_url'],
                        'external_url' => $data['external_urls']['spotify'] ?? "https://open.spotify.com/album/{$id}",
                        'title' => $data['name'] ?? 'Álbum de Spotify',
                        'artist' => implode(', ', array_filter($artistNames)),
                        'total_tracks' => $data['total_tracks'] ?? null,
                        'image' => $image,
                        'release_date' => $data['release_date'] ?? null,
                    ];
                }

                return [
                    'type' => $type,
                    'id' => $id,
                    'uri' => $parsed['uri'],
                    'embed_url' => $parsed['embed_url'],
                ];
            });
        } catch (\Throwable $e) {
            Log::error("SpotifyService: Exception resolving {$url}: " . $e->getMessage());
            return [
                'type' => $parsed['type'],
                'id' => $parsed['id'],
                'uri' => $parsed['uri'],
                'embed_url' => $parsed['embed_url'],
            ];
        }
    }

    /**
     * Search songs in Spotify's catalog for DJ suggestions or playlist additions.
     */
    public function search(string $query, string $type = 'track', int $limit = 6): array
    {
        $query = trim($query);
        if (empty($query)) {
            return [];
        }

        $token = $this->getAccessToken();
        if (!$token) {
            return [];
        }

        try {
            $res = Http::withToken($token)
                ->timeout(6)
                ->get('https://api.spotify.com/v1/search', [
                    'q' => $query,
                    'type' => $type,
                    'limit' => min(max($limit, 1), 20),
                ]);

            if (!$res->successful()) {
                Log::warning('SpotifyService: Search failed: ' . $res->status());
                return [];
            }

            $items = $res->json("{$type}s.items") ?? [];
            $results = [];

            foreach ($items as $item) {
                if ($type === 'track') {
                    $artistNames = array_map(fn($a) => $a['name'] ?? '', $item['artists'] ?? []);
                    $results[] = [
                        'id' => $item['id'],
                        'name' => $item['name'],
                        'artist' => implode(', ', array_filter($artistNames)),
                        'album' => $item['album']['name'] ?? '',
                        'image' => $item['album']['images'][1]['url'] 
                            ?? $item['album']['images'][0]['url'] 
                            ?? null,
                        'preview_url' => $item['preview_url'] ?? null,
                        'uri' => $item['uri'] ?? "spotify:track:{$item['id']}",
                        'external_url' => $item['external_urls']['spotify'] ?? "https://open.spotify.com/track/{$item['id']}",
                        'duration_ms' => $item['duration_ms'] ?? 0,
                    ];
                }
            }

            return $results;
        } catch (\Throwable $e) {
            Log::error('SpotifyService: Search exception: ' . $e->getMessage());
            return [];
        }
    }
}
