<?php
use Illuminate\Support\Facades\Route;
Route::get("/health/db", fn()=>
  DB::select("SELECT 1 as healthy")[0]->healthy===1
  ? response()->json(['status'=>'ok'])
  : response()->json(['status'=>'fail'], 503));
