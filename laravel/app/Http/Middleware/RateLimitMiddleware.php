<?php
namespace App\Http\Middleware;
use Closure;use Illuminate\Http\Request;use Illuminate\Support\Facades\Cache;
class RateLimitMiddleware{
public function handle(Request $r,Closure $next,$maxAttempts=60,$decay=60){
$key=$r->user()?->id.$r->ip();
if(Cache::get($key,0)>=$maxAttempts)return response()->json(['error'=>'Too many requests'],429);
Cache::add($key,1,$decay);Cache::increment($key);
return $next($r);}
}
