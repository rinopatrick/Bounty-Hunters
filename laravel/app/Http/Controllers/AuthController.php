<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\HasApiTokens;

class AuthController extends Controller
{
    use HasApiTokens;

    public function register(Request $r): JsonResponse
    {
        $r->validate([
            "name"     => "required|string|max:255",
            "email"    => "required|email|unique:users,email",
            "password" => "required|string|confirmed|min:8",
        ]);
        $user = User::create([
            "name"     => $r->name, "email" => $r->email,
            "password" => Hash::make($r->password),
        ]);
        $token = $user->createToken("auth")->plainTextToken;
        return response()->json(["token" => $token, "user" => $user], 201);
    }

    public function login(Request $r): JsonResponse
    {
        $r->validate(["email" => "required|email", "password" => "required|string"]);
        $user = User::where("email", $r->email)->first();
        if (! $user || ! Hash::check($r->password, $user->password)) {
            throw ValidationException::withMessages(["email" => ["Invalid credentials."]]);
        }
        $token = $user->createToken("auth")->plainTextToken;
        return response()->json(["token" => $token, "user" => $user]);
    }

    public function logout(Request $r): JsonResponse
    {
        $r->user()->currentAccessToken()->delete();
        return response()->json(null, 204);
    }
}
