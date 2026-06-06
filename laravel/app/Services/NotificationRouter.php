<?php

namespace App\Services;

use App\Models\NotificationPreference;

class NotificationRouter
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function shouldSend(int $userId, string $channel, string $eventType): bool
    {
        return NotificationPreference::query()
            ->where('user_id', $userId)
            ->where('channel', $channel)
            ->where('event_type', $eventType)
            ->where('enabled', true)
            ->exists();
    }
}
