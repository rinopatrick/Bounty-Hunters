<?php

use App\Services\CacheHealthCheck;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Cache Health API
|--------------------------------------------------------------------------
|
| Exposes a lightweight read-only endpoint so monitoring systems, load
| balancers, and CI health-check probes can verify the cache layer
| without touching the application business logic.
|
*/

Route::get('/health/cache', function (CacheHealthCheck $health): \Illuminate\Http\JsonResponse {
    $status = $health->check();

    return response()->json($status, $status['available'] ? 200 : 503);
});
