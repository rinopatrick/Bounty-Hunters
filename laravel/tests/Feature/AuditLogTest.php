<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\AuditLogEntry;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    public function test_updated_creates_audit_entries(): void
    {
        $post = Post::create(['title' => 'Hello', 'body' => 'World']);
        $post->update(['title' => 'Hi']);

        $this->assertDatabaseHas('audit_log_entries', [
            'auditable_type' => Post::class,
            'auditable_id'   => $post->id,
            'event'          => 'updated',
        ]);
    }
}
