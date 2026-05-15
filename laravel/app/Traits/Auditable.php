<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;

/**
 * Auditable — adds automatic change tracking to any Eloquent model.
 *
 * Usage:
 *   class Post extends Model { use Auditable; }
 *
 * Each update/delete records an AuditLog entry per changed column.
 */
trait Auditable
{
    protected static function bootAuditable(): void
    {
        static::updated(function (Model $model) {
            $changes = $model->getChanges();
            $old     = $model->getOriginal();
            foreach ($changes as $key => $newValue) {
                if (in_array($key, $model->getHidden(), true)) continue;
                $oldValue = Arr::get($old, $key);
                if ($oldValue == $newValue) continue;
                AuditLogEntry::record(
                    $model,
                    'updated',
                    ['field' => $key, 'old' => $oldValue, 'new' => $newValue],
                );
            }
        });

        static::deleted(function (Model $model) {
            AuditLogEntry::record(
                $model,
                'deleted',
                ['attributes' => $model->getAttributes()],
            );
        });
    }
}
