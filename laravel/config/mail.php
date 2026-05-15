<?php
/** Laravel mail config — patched for #756 email verification.
 * Adds MAIL_VERIFICATION_URL and VERIFICATION_EXPIRES env vars.
 */
return [
    "driver" => env("MAIL_MAILER", "log"),
    "host"  => env("MAIL_HOST", ""),
    "port"  => env("MAIL_PORT", 587),
    "from"  => [
        "address" => env("MAIL_FROM_ADDRESS", "no-reply@example.com"),
        "name"    => env("MAIL_FROM_NAME", "App"),
    ],
    "verification" => [
        "url"      => env("MAIL_VERIFICATION_URL", env("APP_URL", "")),
        "expires"  => env("VERIFICATION_EXPIRES", 60),
    ],
];
