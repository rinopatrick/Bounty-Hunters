<?php

namespace Tests\Feature;

use App\Services\CacheHealthCheck;
use Illuminate\Cache\CacheManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Feature tests for the Laravel cache health check system.
 *
 * @covers \App\Services\CacheHealthCheck
 * @covers \App\Console\Commands\CacheStatusCommand
 */
class CacheHealthCheckTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @test CacheHealthCheck reports status instead of throwing.
     */
    public function health_check_returns_structured_status(): void
    {
        $cache  = $this->app->make(CacheManager::class);
        $check  = new CacheHealthCheck($cache, 2000);
        $result = $check->check();

        $this->assertIsArray($result);
        $this->assertArrayHasKey('available', $result);
        $this->assertArrayHasKey('driver',    $result);
        $this->assertArrayHasKey('latency_ms', $result);

        $this->assertIsBool($result['available']);
        $this->assertIsString($result['driver']);
        $this->assertIsFloat($result['latency_ms']);
    }

    /**
     * @test CacheHealthCheck reports healthy when the file driver is used.
     */
    public function file_driver_reports_healthy(): void
    {
        config(['cache.default' => 'file']);
        $cache = $this->app->make(CacheManager::class);
        $check = new CacheHealthCheck($cache, 2000);

        $this->assertTrue($check->check()['available']);
    }

    /**
     * @test cache:status command exits with success when cache is healthy.
     */
    public function cache_status_command_succeeds_when_healthy(): void
    {
        $exitCode = $this->artisan('cache:status')->exitCode;

        $this->assertSame(0, $exitCode, 'cache:status should exit 0 when the cache driver is available.');
    }

    /**
     * @test cache:status respects the health_check_enabled config flag.
     */
    public function cache_status_respects_disabled_flag(): void
    {
        config(['cache.health_check_enabled' => false]);
        $exitCode = $this->artisan('cache:status')->exitCode;

        $this->assertSame(0, $exitCode, 'cache:status should exit 0 (no-op) when health checks are disabled.');
    }
}
