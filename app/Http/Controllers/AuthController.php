<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Obtener el usuario autenticado actual.
     */
    public function user(Request $request)
    {
        $user = $request->user() ?? Auth::user();

        if ($user) {
            return response()->json([
                'authenticated' => true,
                'user' => $user
            ]);
        }

        return response()->json([
            'authenticated' => false,
            'user' => null
        ]);
    }

    /**
     * Función de Login para la API y la aplicación web/móvil.
     */
    public function login(Request $request)
    {
        $loginInput = $request->input('username') ?? $request->input('email');
        $password = $request->input('password');

        if (empty($loginInput) || empty($password)) {
            throw ValidationException::withMessages([
                'username' => ['Por favor ingresá usuario/email y contraseña.'],
                'email' => ['Por favor ingresá usuario/email y contraseña.'],
            ]);
        }

        $remember = $request->boolean('remember');

        // Buscar usuario por username o por email (soporta ambos)
        $user = User::where('username', strtolower($loginInput))
            ->orWhere('email', strtolower($loginInput))
            ->first();

        if (!$user || !Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'username' => ['Las credenciales ingresadas son incorrectas.'],
                'email' => ['Las credenciales ingresadas son incorrectas.'],
            ]);
        }

        // Autenticar en la sesión si está disponible
        Auth::login($user, $remember);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        // Generar Token de Acceso Sanctum para clientes API (React Native / Móvil / Web)
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => '¡Bienvenido/a de nuevo!',
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username ?? null,
                'email' => $user->email,
                'role' => $user->role ?? 'user',
            ]
        ], 200);
    }

    /**
     * Registro de nuevo usuario.
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255', 'unique:users'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'string', 'min:6'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'username' => strtolower($validated['username']),
            'email' => strtolower($validated['email']),
            'password' => Hash::make($validated['password']),
        ]);

        Auth::login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Cuenta creada exitosamente',
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $user
        ], 201);
    }

    /**
     * Cierre de sesión y revocación de tokens.
     */
    public function logout(Request $request)
    {
        if ($request->user() && method_exists($request->user(), 'currentAccessToken')) {
            $request->user()->currentAccessToken()?->delete();
        }

        Auth::logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json([
            'success' => true,
            'message' => 'Sesión cerrada correctamente'
        ]);
    }
}
