<?php

namespace App\Http\Controllers;

use App\Models\NotificationPreference;
use App\Services\NotificationRouter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationPreferenceController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            NotificationPreference::where('user_id', auth()->id())->get()
        );
    }

    public function update(Request $r, NotificationPreference $pref): JsonResponse
    {
        $pref->update($r->validate(['enabled' => ['required', 'boolean']]));
        return response()->json($pref);
    }

    public function bulkUpdate(Request $r): JsonResponse
    {
        $data = $r->validate([
            'preferences' => ['required', 'array'],
            'preferences.*.id' => ['required', 'integer', 'exists:notification_preferences,id'],
            'preferences.*.enabled' => ['required', 'boolean'],
        ]);
        foreach ($data['preferences'] as $item) {
            NotificationPreference::where('id', $item['id'])->update(['enabled' => $item['enabled']]);
        }
        return response()->json(NotificationPreference::whereIn('id', collect($data['preferences'])->pluck('id'))->get());
    }
}
