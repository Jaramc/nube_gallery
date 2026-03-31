/**
 * Módulo de gestión de base de datos (localStorage)
 * @module database
 */

import { CONFIG } from './config.js';

/**
 * Obtiene la base de datos desde localStorage
 * @returns {{usuarios: Array, publicaciones: Array}} Base de datos
 */
export function getDB() {
	try {
		const raw = localStorage.getItem(CONFIG.KEYS.DB);
		if (!raw) {
			return { usuarios: [], publicaciones: [] };
		}

		const parsed = JSON.parse(raw);
		return {
			usuarios: Array.isArray(parsed.usuarios) ? parsed.usuarios : [],
			publicaciones: Array.isArray(parsed.publicaciones) ? parsed.publicaciones : []
		};
	} catch (error) {
		console.error('Error al obtener DB:', error);
		return { usuarios: [], publicaciones: [] };
	}
}

/**
 * Guarda la base de datos en localStorage
 * @param {{usuarios: Array, publicaciones: Array}} db - Base de datos a guardar
 */
export function saveDB(db) {
	try {
		localStorage.setItem(CONFIG.KEYS.DB, JSON.stringify(db));
		return true;
	} catch (error) {
		console.error('Error al guardar DB:', error);
		return false;
	}
}

/**
 * Obtiene el usuario actual desde la sesión
 * @returns {{user: Object|null, userId: number|null}} Usuario actual
 */
export function getCurrentUser() {
	const db = getDB();
	const userId = Number(localStorage.getItem(CONFIG.KEYS.CURRENT_USER));

	if (!userId || isNaN(userId)) {
		return { user: null, userId: null };
	}

	const user = db.usuarios.find(u => u.id === userId);
	return { user: user || null, userId };
}

/**
 * Verifica si hay una sesión activa y válida
 * @returns {boolean} True si hay sesión válida
 */
export function hasValidSession() {
	const { user } = getCurrentUser();
	if (!user) return false;

	const lastActivity = localStorage.getItem(CONFIG.KEYS.LAST_ACTIVITY);
	if (!lastActivity) return false;

	const now = Date.now();
	const lastActivityTime = parseInt(lastActivity, 10);
	const timeoutMs = CONFIG.SESSION.TIMEOUT_MINUTES * 60 * 1000;

	return (now - lastActivityTime) < timeoutMs;
}

/**
 * Actualiza el timestamp de última actividad
 */
export function updateLastActivity() {
	localStorage.setItem(CONFIG.KEYS.LAST_ACTIVITY, Date.now().toString());
}

/**
 * Cierra la sesión actual
 */
export function logout() {
	localStorage.removeItem(CONFIG.KEYS.CURRENT_USER);
	localStorage.removeItem(CONFIG.KEYS.LAST_ACTIVITY);
}

/**
 * Inicia sesión con un usuario
 * @param {Object} user - Usuario a iniciar sesión
 */
export function login(user) {
	localStorage.setItem(CONFIG.KEYS.CURRENT_USER, String(user.id));
	updateLastActivity();

	// Actualizar último login
	const db = getDB();
	const userIndex = db.usuarios.findIndex(u => u.id === user.id);
	if (userIndex >= 0) {
		db.usuarios[userIndex].ultimoLogin = new Date().toISOString();
		saveDB(db);
	}
}

/**
 * Asegura que los usuarios demo existan en la BD
 */
export function ensureDemoUsers() {
	const db = getDB();
	let changed = false;

	CONFIG.DEMO_USERS.forEach(demo => {
		const exists = db.usuarios.some(u => u.correo === demo.correo);
		if (!exists) {
			db.usuarios.push({
				...demo,
				bio: 'Usuario de demostración de Nube Gallery',
				avatar: null,
				rol: 'usuario',
				activo: true,
				creadoEn: new Date().toISOString(),
				ultimoLogin: null
			});
			changed = true;
		}
	});

	if (changed) {
		saveDB(db);
	}
}

/**
 * Limpia datos antiguos o inválidos
 */
export function cleanupDB() {
	const db = getDB();

	// Eliminar publicaciones sin usuario
	db.publicaciones = db.publicaciones.filter(pub => {
		return db.usuarios.some(u => u.id === pub.usuarioId);
	});

	// Asegurar interacciones válidas
	db.publicaciones.forEach(pub => {
		if (!Array.isArray(pub.likes)) pub.likes = [];
		if (!Array.isArray(pub.comentarios)) pub.comentarios = [];

		// Eliminar likes de usuarios que ya no existen
		pub.likes = pub.likes.filter(userId =>
			db.usuarios.some(u => u.id === userId)
		);

		// Eliminar comentarios de usuarios que ya no existen
		pub.comentarios = pub.comentarios.filter(com =>
			db.usuarios.some(u => u.id === com.userId)
		);
	});

	saveDB(db);
}
