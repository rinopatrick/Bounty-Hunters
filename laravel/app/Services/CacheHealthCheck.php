<?php

namespace App\Services;

use Illuminate\Cache\CacheManager;
use Illuminate\Support\Arr;

/**
 * CacheHealthCheck — validates the active Laravel cache store
 * and returns a structured status record.
 */
class CacheHealthCheck
{
    /**
     * @param  \Illuminate\Cache\CacheManager  $cache
     * @param  int  $timeoutMs  connection timeout in milliseconds
     */
    public function __construct(
        protected CacheManager $cache,
        protected int $timeoutMs = 2000,
    ) {}

    /**
     * Run the health check and return a plain array.
     *
     * @return array{available: bool, driver: string, latency_ms: ?float}
     */
    public function check(): array
    {
        $driver = config('cache.default', 'file');
        $start  = microtime(true);

        try {
            $this->cache->store($driver)->get('__health_check_ping__');
            $latencyMs = round((microtime(true) - $start) * 1000, 2);
            return [
                'available'  => true,
                'driver'     => $driver,
                'latency_ms' => $latencyMs,
            ];
        } catch (\Throwable $e) {
            $latencyMs = round((microtime(true) - $start) * 1000, 2);
            return [
                'available'  => false,
                'driver'     => $driver,
                'latency_ms' => $latencyMs,
            ];
        }
    }
}
