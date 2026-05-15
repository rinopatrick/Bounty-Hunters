<?php

namespace App\Console\Commands;

use App\Services\CacheHealthCheck;
use Illuminate\Console\Command;
use Illuminate\Support\Arr;

/**
 * Artisan command: php artisan cache:status
 *
 * Runs the cache health check and prints a human-readable summary.
 */
class CacheStatusCommand extends Command
{
    protected $signature = 'cache:status';
    protected $description = 'Display the current cache store health status.';

    public function handle(CacheHealthCheck $health): int
    {
        if (! config('cache.health_check_enabled', true)) {
            $this->components->warn('Cache health checks are disabled (cache.health_check_enabled = false).');

            return Command::SUCCESS;
        }

        $status = $health->check();

        if ($status['available']) {
            $this->components->info(sprintf(
                'Cache driver [%s] is healthy — latency %.2f ms.',
                $status['driver'],
                $status['latency_ms'],
            ));
        } else {
            $this->components->error(sprintf(
                'Cache driver [%s] is UNAVAILABLE — latency %.2f ms before failure.',
                $status['driver'],
                $status['latency_ms'],
            ));
        }

        return $status['available'] ? Command::SUCCESS : Command::FAILURE;
    }
}
