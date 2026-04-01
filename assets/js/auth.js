/**
 * Módulo de autenticación y validación — migrado a Azure Functions
 * @module auth
 *
 * CAMBIOS vs versión localStorage:
 *  - simpleHash() / verifyHash() eliminadas — bcrypt lo maneja la Function en Azure
 *  - registrarUsuario() ahora llama POST /api/Registro
 *  - iniciarSesion() ahora llama POST /api/Login
 *  - Las validaciones locales se mantienen igual (no cambian)
 *  - getCurrentUser() y requireAuth() se mantienen igual
 */

import { CONFIG } from './config.js';
import { login, getCurrentUser } from './database.js';

// ─── Validaciones locales (sin cambios) ──────────────────────────────────────

/**
 * Valida un email
 * @param {string} email
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateEmail(email) {
	if (!email || typeof email !== 'string') {
		return { valid: false, error: 'El email es requerido' };
	}

	const trimmed = email.trim();
	if (trimmed.length < 6) {
		return { valid: false, error: 'El email debe tener al menos 6 caracteres' };
	}

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(trimmed)) {
		return { valid: false, error: 'El email no tiene un formato válido' };
	}

	return { valid: true, error: null };
}

/**
 * Valida una contraseña
 * @param {string} password
 * @returns {{valid: boolean, error: string|null, strength: string}}
 */
export function validatePassword(password) {
	if (!password || typeof password !== 'string') {
		return { valid: false, error: 'La contraseña es requerida', strength: 'none' };
	}

	if (password.length < CONFIG.VALIDATION.MIN_PASSWORD_LENGTH) {
		return {
			valid: false,
			error: `La contraseña debe tener al menos ${CONFIG.VALIDATION.MIN_PASSWORD_LENGTH} caracteres`,
			strength: 'weak'
		};
	}

	// Calcular fortaleza
	let score = 0;
	if (password.length >= 12)          score++;
	if (/[a-z]/.test(password))         score++;
	if (/[A-Z]/.test(password))         score++;
	if (/[0-9]/.test(password))         score++;
	if (/[^a-zA-Z0-9]/.test(password))  score++;

	const strength = score >= 4 ? 'strong' : score >= 3 ? 'medium' : 'weak';

	return { valid: true, error: null, strength };
}

/**
 * Valida un nombre de usuario
 * @param {string} nombre
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateNombre(nombre) {
	if (!nombre || typeof nombre !== 'string') {
		return { valid: false, error: 'El nombre es requerido' };
	}

	const trimmed = nombre.trim();
	if (trimmed.length < CONFIG.VALIDATION.MIN_NOMBRE_LENGTH) {
		return { valid: false, error: `El nombre debe tener al menos ${CONFIG.VALIDATION.MIN_NOMBRE_LENGTH} caracteres` };
	}

	if (trimmed.length > 120) {
		return { valid: false, error: 'El nombre es demasiado largo (máximo 120 caracteres)' };
	}

	return { valid: true, error: null };
}

// ─── Autenticación via API ────────────────────────────────────────────────────

/**
 * Registra un nuevo usuario llamando a la Azure Function
 * @param {Object} datos - { nombre, correo, contrasena }
 * @returns {Promise<{success: boolean, error: string|null, user: Object|null}>}
 */
export async function registrarUsuario({ nombre, correo, contrasena }) {
	// Validaciones locales primero (evita llamadas innecesarias a la API)
	const nombreVal = validateNombre(nombre);
	if (!nombreVal.valid) return { success: false, error: nombreVal.error, user: null };

	const emailVal = validateEmail(correo);
	if (!emailVal.valid) return { success: false, error: emailVal.error, user: null };

	const passVal = validatePassword(contrasena);
	if (!passVal.valid) return { success: false, error: passVal.error, user: null };

	// Llamada a la API
	try {
		const res = await fetch(`${CONFIG.API_BASE}/Registro`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				nombre: nombre.trim(),
				correo: correo.trim().toLowerCase(),
				contrasena
			})
		});

		const data = await res.json();

		if (!res.ok) {
			return { success: false, error: data.error || 'Error al registrar', user: null };
		}

		// Guardar sesión local con el usuario que retornó la API
		login(data.usuario);

		return { success: true, error: null, user: data.usuario };

	} catch (err) {
		console.error('Error en registrarUsuario:', err);
		return { success: false, error: 'No se pudo conectar con el servidor', user: null };
	}
}

/**
 * Inicia sesión llamando a la Azure Function
 * @param {string} correo
 * @param {string} contrasena
 * @returns {Promise<{success: boolean, error: string|null, user: Object|null}>}
 */
export async function iniciarSesion(correo, contrasena) {
	if (!correo || !contrasena) {
		return { success: false, error: 'Email y contraseña son requeridos', user: null };
	}

	try {
		const res = await fetch(`${CONFIG.API_BASE}/Login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				correo: correo.trim().toLowerCase(),
				contrasena
			})
		});

		const data = await res.json();

		if (!res.ok) {
			return { success: false, error: data.error || 'Credenciales inválidas', user: null };
		}

		// Guardar sesión local
		login(data.usuario);

		return { success: true, error: null, user: data.usuario };

	} catch (err) {
		console.error('Error en iniciarSesion:', err);
		return { success: false, error: 'No se pudo conectar con el servidor', user: null };
	}
}

// ─── Protección de rutas (sin cambios) ───────────────────────────────────────

/**
 * Protege una página — redirige si no hay sesión válida
 * @param {string} redirectTo
 * @returns {boolean}
 */
export function requireAuth(redirectTo = 'loguin.html') {
	const { user } = getCurrentUser();
	if (!user) {
		window.location.href = redirectTo;
		return false;
	}
	return true;
}
