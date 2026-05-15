<?php
namespace App\Http\Controllers;
use App\Models\Migration;
use Illuminate\Http\JsonResponse;

class HealthController {
public function database(JsonResponse $r): JsonResponse {
return $r->setStatusCode(200)
->json(['status'=>"ok",'migrations_pending'=>Migration::whereNotNull("migration")->count()]);
}}
