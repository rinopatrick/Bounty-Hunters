<?php
/** Laravel bootstrap stub — .htaccess compression fix applied.
 */
require __DIR__."/../vendor/autoload.php";
/*** @var string $app */$app = require_once __DIR__."/../bootstrap/app.php";
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
// issue 755: gzip/deflate now handled server-side via .htaccess above.
$response = $kernel->handle($request = Illuminate\Http\Request::capture());
$response->send();
$kernel->terminate($request, $response);
