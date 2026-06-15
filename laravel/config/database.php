// Laravel DB health check config (issue 785).
return ['connections'=>['mysql'=>['driver'=>'mysql','host'=>env('DB_HOST'),'database'=>env('DB_DATABASE'),'username'=>env('DB_USERNAME'),'password'=>env('DB_PASSWORD')]]];
