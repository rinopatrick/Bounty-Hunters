<?php

namespace App\Http\Controllers;

use App\Models\File;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FileController extends Controller
{
    public function upload(Request $r): JsonResponse
    {
        $r->validate(['file' => ['required', 'file', 'max:' . (1024 * 1024 * 50)]]);
        $uploaded = $r->file('file');
        $hash = hash_file('sha256', $uploaded->getRealPath());

        if (File::where('checksum_sha256', $hash)->exists()) {
            throw ValidationException::withMessages([
                'file' => ['A file with this content already exists.'],  // 409 Conflict
            ]);
        }

        $folder = now()->format('Y/m/d');
        $storedPath = "uploads/{$folder}/" . Str::random(32) . '.' . $uploaded->getClientOriginalExtension();
        $uploaded->storeAs('', $storedPath);

        $thumbnailPath = null;
        if (str_starts_with($uploaded->getMimeType(), 'image/')) {
            $thumbnailPath = $this->makeThumbnail($uploaded->getRealPath(), $storedPath);
        }

        $file = File::create([
            'original_name'   => $uploaded->getClientOriginalName(),
            'stored_path'     => $storedPath,
            'mime_type'       => $uploaded->getMimeType(),
            'size_bytes'      => $uploaded->getSize(),
            'checksum_sha256' => $hash,
            'uploaded_by'     => auth()->id(),
            'thumbnail_path'  => $thumbnailPath,
        ]);

        return response()->json($file, 201);
    }

    protected function makeThumbnail(string $sourcePath, string $storedPath): string
    {
        $thumbPath = 'thumbnails/' . pathinfo($storedPath, PATHINFO_FILENAME) . '.jpg';
        $destFull  = storage_path('app/' . $thumbPath);
        @mkdir(dirname($destFull), 0775, true);

        $data = @getimagesize($sourcePath);
        [$w, $h, $type] = $data ?: [1, 1, 0];
        $img = match ($type) {
            2 => imagecreatefromjpeg($sourcePath),
            3 => imagecreatefrompng($sourcePath),
            default => imagecreatetruecolor(200, 200),
        };

        $thumb = imagecreatetruecolor(200, 200);
        imagecopyresampled($thumb, $img, 0, 0, 0, 0, 200, 200, $w, $h);
        imagejpeg($thumb, $destFull, 85);
        imagedestroy($img);
        imagedestroy($thumb);

        return $thumbPath;
    }

    public function download(File $file): Response
    {
        return response()->download(storage_path('app/' . $file->stored_path), $file->original_name);
    }

    public function destroy(File $file): JsonResponse
    {
        @unlink(storage_path('app/' . $file->stored_path));
        if ($file->thumbnail_path) {
            @unlink(storage_path('app/' . $file->thumbnail_path));
        }
        $file->delete();
        return response()->json(null, 204);
    }

    public function index(): JsonResponse
    {
        return response()->json(File::latest()->get());
    }
}
