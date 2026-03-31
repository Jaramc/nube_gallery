/**
 * Módulo de autenticación y validación
 * @module auth
 */

import { CONFIG } from './config.js';
import { getDB, saveDB, login } from './database.js';

/**
 * Hash simple de contraseña (NO usar en producción)
 * En producción se debe usar bcrypt o similar del lado del servidor
 * @param {string} password - Contraseña a hashear
 * @returns {string} Hash de la contraseña
 */
function simpleHash(password) {
	let hash = 0;
	for (let i = 0; i < password.length; i++) {
		const char = password.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	// Agregar salt simulado
	return `hashed_${Math.abs(hash)}_${password.length}`;
}

/**
 * Verifica un hash de contraseña
 * @param {string} password - Contraseña en texto plano
 * @param {string} hash - Hash almacenado
 * @returns {boolean} True si coinciden
 */
function verifyHash(password, hash) {
	return simpleHash(password) === hash;
}

/**
 * Valida un email
 * @param {string} email - Email a validar
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
 * @param {string} password - Contraseña a validar
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
	let strength = 'weak';
	let score = 0;

	if (password.length >= 12) score++;
	if (/[a-z]/.test(password)) score++;
	if (/[A-Z]/.test(password)) score++;
	if (/[0-9]/.test(password)) score++;
	if (/[^a-zA-Z0-9]/.test(password)) score++;

	if (score >= 4) strength = 'strong';
	else if (score >= 3) strength = 'medium';

	return { valid: true, error: null, strength };
}

/**
 * Valida un nombre de usuario
 * @param {string} nombre - Nombre a validar
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

/**
 * Registra un nuevo usuario
 * @param {Object} datos - Datos del usuario
 * @param {string} datos.nombre - Nombre completo
 * @param {string} datos.correo - Email
 * @param {string} datos.contrasena - Contraseña
 * @returns {{success: boolean, error: string|null, user: Object|null}}
 */
export function registrarUsuario({ nombre, correo, contrasena }) {
	// Validaciones
	const nombreValidation = validateNombre(nombre);
	if (!nombreValidation.valid) {
		return { success: false, error: nombreValidation.error, user: null };
	}

	const emailValidation = validateEmail(correo);
	if (!emailValidation.valid) {
		return { success: false, error: emailValidation.error, user: null };
	}

	const passwordValidation = validatePassword(contrasena);
	if (!passwordValidation.valid) {
		return { success: false, error: passwordValidation.error, user: null };
	}

	// Verificar si el usuario ya existe
	const db = getDB();
	const correoLower = correo.trim().toLowerCase();
	const existe = db.usuarios.some(u => u.correo === correoLower);

	if (existe) {
		return { success: false, error: 'Este correo ya está registrado', user: null };
	}

	// Crear nuevo usuario
	const nuevoUsuario = {
		id: Date.now(),
		nombre: nombre.trim(),
		correo: correoLower,
		contrasena: simpleHash(contrasena),
		bio: '',
		avatar: null,
		rol: 'usuario',
		activo: true,
		creadoEn: new Date().toISOString(),
		ultimoLogin: new Date().toISOString()
	};

	db.usuarios.push(nuevoUsuario);
	saveDB(db);
	login(nuevoUsuario);

	return { success: true, error: null, user: nuevoUsuario };
}

/**
 * Inicia sesión de un usuario
 * @param {string} correo - Email del usuario
 * @param {string} contrasena - Contraseña del usuario
 * @returns {{success: boolean, error: string|null, user: Object|null}}
 */
export function iniciarSesion(correo, contrasena) {
	// Validaciones básicas
	if (!correo || !contrasena) {
		return { success: false, error: 'Email y contraseña son requeridos', user: null };
	}

	const db = getDB();
	const correoLower = correo.trim().toLowerCase();

	// Buscar usuario
	const usuario = db.usuarios.find(u => u.correo === correoLower);

	if (!usuario) {
		return { success: false, error: 'Credenciales inválidas', user: null };
	}

	if (!usuario.activo) {
		return { success: false, error: 'Esta cuenta ha sido desactivada', user: null };
	}

	// Verificar contraseña
	if (!verifyHash(contrasena, usuario.contrasena)) {
		return { success: false, error: 'Credenciales inválidas', user: null };
	}

	// Iniciar sesión
	login(usuario);

	return { success: true, error: null, user: usuario };
}

/**
 * Cambia la contraseña de un usuario
 * @param {number} userId - ID del usuario
 * @param {string} contrasenaActual - Contraseña actual
 * @param {string} contrasenaNueva - Nueva contraseña
 * @returns {{success: boolean, error: string|null}}
 */
export function cambiarContrasena(userId, contrasenaActual, contrasenaNueva) {
	const db = getDB();
	const usuario = db.usuarios.find(u => u.id === userId);

	if (!usuario) {
		return { success: false, error: 'Usuario no encontrado' };
	}

	if (!verifyHash(contrasenaActual, usuario.contrasena)) {
		return { success: false, error: 'La contraseña actual es incorrecta' };
	}

	const passwordValidation = validatePassword(contrasenaNueva);
	if (!passwordValidation.valid) {
		return { success: false, error: passwordValidation.error };
	}

	// Actualizar contraseña
	const userIndex = db.usuarios.findIndex(u => u.id === userId);
	db.usuarios[userIndex].contrasena = simpleHash(contrasenaNueva);
	saveDB(db);

	return { success: true, error: null };
}

/**
 * Protege una página - redirige si no hay sesión válida
 * @param {string} redirectTo - URL a donde redirigir si no hay sesión
 */
export function requireAuth(redirectTo = '/login.html') {
	const { user } = getCurrentUser();
	if (!user) {
		window.location.href = redirectTo;
		return false;
	}
	return true;
}
