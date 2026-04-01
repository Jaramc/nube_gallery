/**
 * Módulo de gestión de datos — migrado a Azure SQL via Azure Functions
 * @module database
 *
 * CAMBIOS vs versión localStorage:
 *  - getDB() / saveDB() eliminadas — cada función llama su propio endpoint
 *  - ensureDemoUsers() / cleanupDB() eliminadas — la BD real las maneja
 *  - getCurrentUser() lee del localStorage (sesión) pero el user viene de la API
 *  - login() / logout() mantienen localStorage solo para la sesión activa
 */

import { CONFIG } from './config.js';

// ─── Helper interno ──────────────────────────────────────────────────────────

/**
 * Hace una llamada a la API con manejo de errores centralizado
 * @param {string} endpoint - Ruta del endpoint (sin API_BASE)
 * @param {Object} options - Opciones de fetch
 * @returns {Promise<{ok: boolean, data: any, error: string|null}>}
 */
async function apiFetch(endpoint, options = {}) {
	try {
		const res = await fetch(`${CONFIG.API_BASE}/${endpoint}`, {
			headers: { 'Content-Type': 'application/json' },
			...options
		});

		const data = await res.json();

		if (!res.ok) {
			return { ok: false, data: null, error: data.error || 'Error del servidor' };
		}

		return { ok: true, data, error: null };

	} catch (err) {
		console.error(`Error en API [${endpoint}]:`, err);
		return { ok: false, data: null, error: 'No se pudo conectar con el servidor' };
	}
}

// ─── Sesión (localStorage) ───────────────────────────────────────────────────

/**
 * Obtiene el usuario actual desde la sesión local
 * @returns {{user: Object|null, userId: number|null}}
 */
export function getCurrentUser() {
	try {
		const raw = localStorage.getItem(CONFIG.KEYS.CURRENT_USER);
		if (!raw) return { user: null, userId: null };

		const user = JSON.parse(raw);
		return { user, userId: user?.id || null };
	} catch {
		return { user: null, userId: null };
	}
}

/**
 * Verifica si hay una sesión activa y válida (por tiempo)
 * @returns {boolean}
 */
export function hasValidSession() {
	const { user } = getCurrentUser();
	if (!user) return false;

	const lastActivity = localStorage.getItem(CONFIG.KEYS.LAST_ACTIVITY);
	if (!lastActivity) return false;

	const timeoutMs = CONFIG.SESSION.TIMEOUT_MINUTES * 60 * 1000;
	return (Date.now() - parseInt(lastActivity, 10)) < timeoutMs;
}

/**
 * Actualiza el timestamp de última actividad
 */
export function updateLastActivity() {
	localStorage.setItem(CONFIG.KEYS.LAST_ACTIVITY, Date.now().toString());
}

/**
 * Guarda al usuario en sesión local después del login
 * @param {Object} user - Usuario retornado por la API
 */
export function login(user) {
	localStorage.setItem(CONFIG.KEYS.CURRENT_USER, JSON.stringify(user));
	updateLastActivity();
}

/**
 * Cierra la sesión actual
 */
export function logout() {
	localStorage.removeItem(CONFIG.KEYS.CURRENT_USER);
	localStorage.removeItem(CONFIG.KEYS.LAST_ACTIVITY);
}

// ─── Publicaciones ───────────────────────────────────────────────────────────

/**
 * Obtiene el feed público de publicaciones
 * @returns {Promise<{ok: boolean, publicaciones: Array, error: string|null}>}
 */
export async function getPublicacionesPublicasAPI() {
	const { ok, data, error } = await apiFetch('Publicaciones');
	return {
		ok,
		publicaciones: ok ? (data.publicaciones || []) : [],
		error
	};
}

/**
 * Crea una nueva publicación
 * @param {Object} datos - { titulo, categoria, visibilidad, descripcion }
 * @returns {Promise<{ok: boolean, publicacion: Object|null, error: string|null}>}
 */
export async function crearPublicacionAPI(datos) {
	const { user } = getCurrentUser();
	if (!user) return { ok: false, publicacion: null, error: 'No hay sesión activa' };

	const { ok, data, error } = await apiFetch('Publicaciones', {
		method: 'POST',
		body: JSON.stringify({ ...datos, usuario_id: user.id })
	});

	return {
		ok,
		publicacion: ok ? data.publicacion : null,
		error
	};
}
