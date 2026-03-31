/**
 * Módulo de funciones utilidades
 * @module utils
 */

/**
 * Escapa HTML para prevenir XSS
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */
export function escapeHTML(text) {
	if (text === null || text === undefined) return '';

	return String(text)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/**
 * Formatea una fecha ISO a texto legible
 * @param {string} isoDate - Fecha en formato ISO
 * @param {boolean} includeTime - Si incluir la hora
 * @returns {string} Fecha formateada
 */
export function formatFecha(isoDate, includeTime = false) {
	if (!isoDate) return '--';

	try {
		const date = new Date(isoDate);

		const options = {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		};

		if (includeTime) {
			options.hour = '2-digit';
			options.minute = '2-digit';
		}

		return date.toLocaleString('es-ES', options);
	} catch (error) {
		console.error('Error al formatear fecha:', error);
		return '--';
	}
}

/**
 * Formatea una fecha relativa (hace 2 horas, hace 3 días, etc.)
 * @param {string} isoDate - Fecha en formato ISO
 * @returns {string} Fecha relativa
 */
export function formatFechaRelativa(isoDate) {
	if (!isoDate) return '--';

	try {
		const date = new Date(isoDate);
		const now = new Date();
		const diffMs = now - date;
		const diffSecs = Math.floor(diffMs / 1000);
		const diffMins = Math.floor(diffSecs / 60);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffSecs < 60) return 'Justo ahora';
		if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
		if (diffHours < 24) return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
		if (diffDays < 7) return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
		if (diffDays < 30) {
			const weeks = Math.floor(diffDays / 7);
			return `Hace ${weeks} semana${weeks !== 1 ? 's' : ''}`;
		}
		if (diffDays < 365) {
			const months = Math.floor(diffDays / 30);
			return `Hace ${months} mes${months !== 1 ? 'es' : ''}`;
		}

		const years = Math.floor(diffDays / 365);
		return `Hace ${years} año${years !== 1 ? 's' : ''}`;
	} catch (error) {
		console.error('Error al formatear fecha relativa:', error);
		return '--';
	}
}

/**
 * Formatea bytes a formato legible
 * @param {number} bytes - Cantidad de bytes
 * @param {number} decimals - Cantidad de decimales
 * @returns {string} Tamaño formateado
 */
export function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Trunca un texto a una longitud máxima
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @param {string} suffix - Sufijo a agregar
 * @returns {string} Texto truncado
 */
export function truncate(text, maxLength = 100, suffix = '...') {
	if (!text || text.length <= maxLength) return text;
	return text.substring(0, maxLength).trim() + suffix;
}

/**
 * Debounce - retrasa la ejecución de una función
 * @param {Function} func - Función a ejecutar
 * @param {number} delay - Delay en milisegundos
 * @returns {Function} Función con debounce
 */
export function debounce(func, delay = 300) {
	let timeoutId;
	return function (...args) {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => func.apply(this, args), delay);
	};
}

/**
 * Genera un ID único
 * @returns {string} ID único
 */
export function generateId() {
	return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Valida un archivo según tipo y tamaño
 * @param {File} file - Archivo a validar
 * @param {Array<string>} allowedTypes - Tipos permitidos
 * @param {number} maxSize - Tamaño máximo en bytes
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateFile(file, allowedTypes, maxSize) {
	if (!file) {
		return { valid: false, error: 'No se seleccionó ningún archivo' };
	}

	if (!allowedTypes.includes(file.type)) {
		return { valid: false, error: `Tipo de archivo no permitido. Permitidos: ${allowedTypes.join(', ')}` };
	}

	if (file.size > maxSize) {
		return { valid: false, error: `El archivo es demasiado grande. Máximo: ${formatBytes(maxSize)}` };
	}

	return { valid: true, error: null };
}

/**
 * Convierte un archivo a DataURL (Base64)
 * @param {File} file - Archivo a convertir
 * @returns {Promise<string>} DataURL del archivo
 */
export function fileToDataURL(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
		reader.readAsDataURL(file);
	});
}

/**
 * Convierte un Blob a DataURL
 * @param {Blob} blob - Blob a convertir
 * @returns {Promise<string>} DataURL del blob
 */
export function blobToDataURL(blob) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(new Error('No se pudo leer el blob'));
		reader.readAsDataURL(blob);
	});
}

/**
 * Copia texto al portapapeles
 * @param {string} text - Texto a copiar
 * @returns {Promise<boolean>} True si se copió exitosamente
 */
export async function copyToClipboard(text) {
	try {
		if (navigator.clipboard) {
			await navigator.clipboard.writeText(text);
			return true;
		} else {
			// Fallback para navegadores antiguos
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			return true;
		}
	} catch (error) {
		console.error('Error al copiar al portapapeles:', error);
		return false;
	}
}

/**
 * Descarga un archivo desde dataURL
 * @param {string} dataUrl - DataURL del archivo
 * @param {string} filename - Nombre del archivo
 */
export function downloadFile(dataUrl, filename) {
	const link = document.createElement('a');
	link.href = dataUrl;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

/**
 * Pausa la ejecución por un tiempo determinado
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise} Promesa que se resuelve después del tiempo
 */
export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
