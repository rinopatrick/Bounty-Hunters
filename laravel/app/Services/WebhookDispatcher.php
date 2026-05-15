<?php

namespace App\Services;

use App\Models\Webhook;
use App\Models\WebhookDelivery;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class WebhookDispatcher
{
    public function __construct(
        private readonly int $maxAttempts = 5,
        private readonly int $baseDelayMs = 1000,
    ) {}

    public function dispatch(Webhook $webhook, array $payload): WebhookDelivery
    {
        $delivery = $webhook->deliveries()->create([
            "event"        => $payload["event"],
            "payload"      => $payload,
            "attempts"     => 0,
            "next_retry_at"=> now(),
        ]);

        $this->send($delivery, $webhook);
        return $delivery->fresh();
    }

    protected function send(WebhookDelivery $delivery, Webhook $webhook): void
    {
        $attempt = 0;
        $lastError = null;

        while ($attempt < $this->maxAttempts) {
            $attempt++;
            $delivery->update(["attempts" => $attempt]);

            try {
                $response = Http::withHeaders([
                    "X-Webhook-Signature" => $this->sign($webhook->secret, $delivery->payload),
                    "Content-Type"        => "application/json",
                ])->post($webhook->url, $delivery->payload);

                $delivery->update([
                    "response_code" => $response->status(),
                    "delivered_at"  => $response->successful() ? now() : null,
                    "next_retry_at" => null,
                ]);
                return;
            } catch (\Throwable $e) {
                $lastError = $e->getMessage();
                $delayMs = $this->baseDelayMs * (2 ** ($attempt - 1));
                $delivery->update(["next_retry_at" => now()->addMilliseconds($delayMs)]);
                if ($attempt < $this->maxAttempts) {
                    sleep((int) ceil($delayMs / 1000));
                }
            }
        }
    }

    protected function sign(string $secret, array $payload): string
    {
        return "sha256=" . hash_hmac("sha256", json_encode($payload), $secret);
    }
}
