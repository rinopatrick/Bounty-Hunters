<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AuditLogEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'auditable_type',
        'auditable_id',
        'event',
        'properties',
        'user_id',
    ];

    protected $casts = ['properties' => 'array', 'user_id' => 'integer'];
}
