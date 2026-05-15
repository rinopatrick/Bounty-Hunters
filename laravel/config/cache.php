<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cache Configuration
    |--------------------------------------------------------------------------
    */

    'default' => env('CACHE_STORE', 'file'),

    'stores' => [

        'file' => [
            'driver'     => 'file',
            'path'       => storage_path('framework/cache/data'),
            'lock_path'  => storage_path('framework/cache'),
        ],

        'array' => [
            'driver' => 'array',
            'serialize' => false,
        ],

        'database' => [

            'driver' => 'database',

            'table'  => env('CACHE_DATABASE_TABLE', 'cache'),

            'connection' => env('CACHE_DATABASE_CONNECTION'),

            'lock_connection' => env('CACHE_DATABASE_LOCK_CONNECTION'),
        ],

        'redis' => [

            'driver' => 'redis',

            'connection' => env('REDIS_CACHE_CONNECTION', 'default'),

            'lock_connection' => env('REDIS_LOCK_CONNECTION', 'default'),
        ],

        'memcached' => [
            'driver' => 'memcached',
            'persistent_id' => env('MEMCACHED_PERSISTENT_ID'),
            'sasl' => [
                env('MEMCACHED_USERNAME'),
                env('MEMCACHED_PASSWORD'),
            ],
            'options' => [
                // Memcached::OPT_CONNECT_TIMEOUT  => 2000,
            ],
            'servers' => [[
                'host' => env('MEMCACHED_HOST', '127.0.0.1'),
                'port' => env('MEMCACHED_PORT', 11211),
                'weight' => 100,
            ]],
        ],

    ],

    'prefix' => env('CACHE_PREFIX', 'laravel_cache'),

    /*
    |--------------------------------------------------------------------------
    | Cache Health Check
    |--------------------------------------------------------------------------
    |
    | When enabled, GET /health/cache calls CacheHealthCheck::check() and
    | returns a JSON status record.  The interval value controls how often
    | (in seconds) the artisan cache:status command refreshes its probe.
    |
    */

    'health_check_enabled' => env('CACHE_HEALTH_CHECK_ENABLED', true),

    'health_check_interval' => env('CACHE_HEALTH_CHECK_INTERVAL', 300),

];
