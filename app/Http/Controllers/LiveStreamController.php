<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Models\Event;

class LiveStreamController extends Controller
{
    /**
     * Get the active stream status for an event.
     */
    public function status($code)
    {
        $event = Event::findByPublicCodeOrFail($code);
        $key = "live_stream_{$event->id}";
        $data = Cache::get($key);

        if (!$data || empty($data['active'])) {
            return response()->json([
                'active' => false,
                'event' => [
                    'id' => $event->id,
                    'title' => $event->title,
                    'couple_names' => $event->couple_names,
                    'public_code' => $event->public_code,
                ],
            ]);
        }

        // Check if heartbeat is expired (>20 seconds)
        $lastHeartbeat = $data['last_heartbeat'] ?? 0;
        if (time() - $lastHeartbeat > 25) {
            Cache::forget($key);
            Cache::forget("{$key}_answer");
            Cache::forget("{$key}_ice_broadcaster");
            Cache::forget("{$key}_ice_viewer");
            return response()->json([
                'active' => false,
                'event' => [
                    'id' => $event->id,
                    'title' => $event->title,
                    'couple_names' => $event->couple_names,
                    'public_code' => $event->public_code,
                ],
            ]);
        }

        // Also check if an answer exists
        $answerData = Cache::get("{$key}_answer");
        $broadcasterCandidates = Cache::get("{$key}_ice_broadcaster", []);
        $viewerCandidates = Cache::get("{$key}_ice_viewer", []);

        return response()->json([
            'active' => true,
            'event' => [
                'id' => $event->id,
                'title' => $event->title,
                'couple_names' => $event->couple_names,
                'public_code' => $event->public_code,
            ],
            'broadcaster_name' => $data['broadcaster_name'] ?? 'Cámara en Vivo',
            'offer' => $data['offer'] ?? null,
            'answer' => $answerData['answer'] ?? null,
            'broadcaster_candidates' => $broadcasterCandidates,
            'viewer_candidates' => $viewerCandidates,
            'started_at' => $data['started_at'] ?? time(),
        ]);
    }

    /**
     * Start a live stream from the mobile broadcaster.
     */
    public function start(Request $request, $code)
    {
        $event = Event::findByPublicCodeOrFail($code);

        $validated = $request->validate([
            'offer' => 'required|array',
            'broadcaster_name' => 'nullable|string|max:100',
            'candidates' => 'nullable|array',
        ]);

        $key = "live_stream_{$event->id}";

        // Save session in Cache for 30 minutes
        $data = [
            'active' => true,
            'offer' => $validated['offer'],
            'broadcaster_name' => $validated['broadcaster_name'] ?: 'Cámara en Vivo',
            'started_at' => time(),
            'last_heartbeat' => time(),
        ];

        Cache::put($key, $data, 1800);
        Cache::forget("{$key}_answer");
        Cache::forget("{$key}_ice_broadcaster");
        Cache::forget("{$key}_ice_viewer");

        if (!empty($validated['candidates'])) {
            Cache::put("{$key}_ice_broadcaster", $validated['candidates'], 1800);
        }

        return response()->json([
            'success' => true,
            'active' => true,
            'message' => 'Transmisión iniciada',
        ]);
    }

    /**
     * Viewer (Projector Screen) submits the SDP answer.
     */
    public function answer(Request $request, $code)
    {
        $event = Event::findByPublicCodeOrFail($code);
        $validated = $request->validate([
            'answer' => 'required|array',
            'candidates' => 'nullable|array',
        ]);

        $key = "live_stream_{$event->id}";
        Cache::put("{$key}_answer", [
            'answer' => $validated['answer'],
            'answered_at' => time(),
        ], 1800);

        if (!empty($validated['candidates'])) {
            $existing = Cache::get("{$key}_ice_viewer", []);
            $merged = array_merge($existing, $validated['candidates']);
            Cache::put("{$key}_ice_viewer", $merged, 1800);
        }

        return response()->json([
            'success' => true,
            'message' => 'Respuesta registrada',
        ]);
    }

    /**
     * Add an ICE candidate (from broadcaster or viewer).
     */
    public function addCandidate(Request $request, $code)
    {
        $event = Event::findByPublicCodeOrFail($code);
        $validated = $request->validate([
            'sender' => 'required|in:broadcaster,viewer',
            'candidate' => 'required|array',
        ]);

        $key = "live_stream_{$event->id}_ice_{$validated['sender']}";
        $candidates = Cache::get($key, []);
        $candidates[] = $validated['candidate'];
        // Keep up to 50 candidates
        if (count($candidates) > 50) {
            $candidates = array_slice($candidates, -50);
        }
        Cache::put($key, $candidates, 1800);

        return response()->json([
            'success' => true,
        ]);
    }

    /**
     * Get ICE candidates sent by the peer.
     */
    public function getCandidates(Request $request, $code)
    {
        $event = Event::findByPublicCodeOrFail($code);
        $sender = $request->query('for') === 'broadcaster' ? 'viewer' : 'broadcaster';
        $key = "live_stream_{$event->id}_ice_{$sender}";
        $candidates = Cache::get($key, []);

        return response()->json([
            'candidates' => $candidates,
        ]);
    }

    /**
     * Keep stream active via heartbeat every 5s.
     */
    public function heartbeat($code)
    {
        $event = Event::findByPublicCodeOrFail($code);
        $key = "live_stream_{$event->id}";
        $data = Cache::get($key);

        if ($data && !empty($data['active'])) {
            $data['last_heartbeat'] = time();
            Cache::put($key, $data, 1800);
            return response()->json(['active' => true]);
        }

        return response()->json(['active' => false]);
    }

    /**
     * Stop the live stream.
     */
    public function stop($code)
    {
        $event = Event::findByPublicCodeOrFail($code);
        $key = "live_stream_{$event->id}";

        Cache::forget($key);
        Cache::forget("{$key}_answer");
        Cache::forget("{$key}_ice_broadcaster");
        Cache::forget("{$key}_ice_viewer");

        return response()->json([
            'success' => true,
            'active' => false,
            'message' => 'Transmisión finalizada',
        ]);
    }
}
