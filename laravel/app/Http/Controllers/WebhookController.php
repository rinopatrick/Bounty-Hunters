<?php

namespace App\Http\Controllers;

use App\Models\Webhook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class WebhookController extends Controller
{
    public function index(Request $r): JsonResponse
    {
        return response()->json(Webhook::with("deliveries")->get());
    }

    public function store(Request $r): JsonResponse
    {
        $data = Validator::make($r->all(), [
            "url"    => ["required", "url"],
            "secret" => ["required", "string", "min:16"],
            "events" => ["required", "array"],
            "active" => ["boolean"],
        ])->validate();

        return response()->json(Webhook::create($data), 201);
    }

    public function show(Webhook $webhook): JsonResponse
    {
        return response()->json($webhook->load("deliveries"));
    }

    public function update(Request $r, Webhook $webhook): JsonResponse
    {
        $webhook->update($r->validate([
            "url"    => ["sometimes", "url"],
            "secret" => ["sometimes", "string", "min:16"],
            "events" => ["sometimes", "array"],
            "active" => ["sometimes", "boolean"],
        ]));
        return response()->json($webhook->fresh());
    }

    public function destroy(Webhook $webhook): JsonResponse
    {
        $webhook->delete();
        return response()->json(null, 204);
    }
}
