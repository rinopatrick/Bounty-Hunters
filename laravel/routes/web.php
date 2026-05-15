<?php
use Illuminate\Support\Facades\Route;
use App\Http\Middleware\RateLimitMiddleware;
Route::middleware([RateLimitMiddleware::class.':60,1'])->group(function(){
Route::get('/dashboard', fn()=>view('dashboard'));
Route::post('/action', fn()=>response()->json(['ok'=>true]));
});
