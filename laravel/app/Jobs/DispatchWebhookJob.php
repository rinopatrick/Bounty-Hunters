<?php

namespace App\Jobs;

use App\Models\Webhook;
use App\Services\WebhookDispatcher;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class DispatchWebhookJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $webhookId,
        public readonly array $payload,
    ) {}

    public function handle(WebhookDispatcher $dispatcher): void
    {
        $webhook = Webhook::findOrFail($this->webhookId);
        $dispatcher->dispatch($webhook, $this->payload);
    }
}
