/**
 * Módulo de gestión de publicaciones
 * @module publicaciones
 */

import { CONFIG } from './config.js';
import { getDB, saveDB, getCurrentUser } from './database.js';
import { validateFile, fileToDataURL, blobToDataURL } from './utils.js';

/**
 * Serializa una lista de archivos a formato almacenable
 * @param {FileList|Array<File>} fileList - Lista de archivos
 * @returns {Promise<Array>} Archivos serializados
 */
export async function serializeFiles(fileList) {
	const files = Array.from(fileList || []);
	const result = [];

	for (const file of files) {
		try {
			const contenido = await fileToDataURL(file);
			result.push({
				nombre: file.name,
				tipo: file.type || 'application/octet-stream',
				tamano: file.size,
				contenido
			});
		} catch (error) {
			console.error(`Error al serializar archivo ${file.name}:`, error);
		}
	}

	return result;
}

/**
 * Valida los archivos de una publicación
 * @param {FileList} imageFiles - Archivos de imagen
 * @param {FileList} docFiles - Archivos de documento
 * @returns {{valid: boolean, error: string|null}}
 */
export function validatePublicacionFiles(imageFiles, docFiles) {
	const images = Array.from(imageFiles || []);
	const docs = Array.from(docFiles || []);

	// Validar cantidad de imágenes
	if (images.length === 0) {
		return { valid: false, error: 'Debes cargar al menos una imagen' };
	}

	if (images.length > CONFIG.FILE_LIMITS.MAX_IMAGES_PER_POST) {
		return { valid: false, error: `Máximo ${CONFIG.FILE_LIMITS.MAX_IMAGES_PER_POST} imágenes por publicación` };
	}

	// Validar cada imagen
	for (const image of images) {
		const validation = validateFile(
			image,
			CONFIG.FILE_LIMITS.ALLOWED_IMAGE_TYPES,
			CONFIG.FILE_LIMITS.MAX_IMAGE_SIZE
		);
		if (!validation.valid) {
			return { valid: false, error: `Imagen "${image.name}": ${validation.error}` };
		}
	}

	// Validar cantidad de documentos
	if (docs.length > CONFIG.FILE_LIMITS.MAX_DOCUMENTS_PER_POST) {
		return { valid: false, error: `Máximo ${CONFIG.FILE_LIMITS.MAX_DOCUMENTS_PER_POST} documentos por publicación` };
	}

	// Validar cada documento
	for (const doc of docs) {
		const validation = validateFile(
			doc,
			CONFIG.FILE_LIMITS.ALLOWED_DOCUMENT_TYPES,
			CONFIG.FILE_LIMITS.MAX_DOCUMENT_SIZE
		);
		if (!validation.valid) {
			return { valid: false, error: `Documento "${doc.name}": ${validation.error}` };
		}
	}

	return { valid: true, error: null };
}

/**
 * Crea una nueva publicación
 * @param {Object} datos - Datos de la publicación
 * @returns {Promise<{success: boolean, error: string|null, publicacion: Object|null}>}
 */
export async function crearPublicacion(datos) {
	const { user } = getCurrentUser();
	if (!user) {
		return { success: false, error: 'Debes iniciar sesión para crear una publicación', publicacion: null };
	}

	const {
		titulo,
		categoria,
		visibilidad,
		descripcion,
		estado = 'publicado',
		imagenes,
		documentos
	} = datos;

	// Validaciones
	if (!titulo || titulo.trim().length < CONFIG.VALIDATION.MIN_TITULO_LENGTH) {
		return { success: false, error: `El título debe tener al menos ${CONFIG.VALIDATION.MIN_TITULO_LENGTH} caracteres`, publicacion: null };
	}

	if (titulo.length > CONFIG.VALIDATION.MAX_TITULO_LENGTH) {
		return { success: false, error: `El título es demasiado largo (máximo ${CONFIG.VALIDATION.MAX_TITULO_LENGTH} caracteres)`, publicacion: null };
	}

	if (!['foto', 'pintura', 'documento'].includes(categoria)) {
		return { success: false, error: 'Categoría inválida', publicacion: null };
	}

	if (!['publico', 'privado', 'solo-curadores'].includes(visibilidad)) {
		return { success: false, error: 'Visibilidad inválida', publicacion: null };
	}

	// Serializar archivos
	let imagenesSerializadas = [];
	let documentosSerializados = [];

	try {
		if (imagenes) {
			imagenesSerializadas = await serializeFiles(imagenes);
		}
		if (documentos) {
			documentosSerializados = await serializeFiles(documentos);
		}
	} catch (error) {
		return { success: false, error: 'Error al procesar los archivos', publicacion: null };
	}

	if (imagenesSerializadas.length === 0) {
		return { success: false, error: 'Debes incluir al menos una imagen', publicacion: null };
	}

	// Crear publicación
	const publicacion = {
		id: Date.now(),
		usuarioId: user.id,
		titulo: titulo.trim(),
		categoria,
		visibilidad,
		descripcion: descripcion?.trim() || '',
		estado,
		imagenes: imagenesSerializadas,
		documentos: documentosSerializados,
		likes: [],
		comentarios: [],
		creadoEn: new Date().toISOString(),
		actualizadoEn: new Date().toISOString()
	};

	const db = getDB();
	db.publicaciones.push(publicacion);
	saveDB(db);

	return { success: true, error: null, publicacion };
}

/**
 * Actualiza una publicación existente
 * @param {number} publicacionId - ID de la publicación
 * @param {Object} cambios - Cambios a aplicar
 * @returns {{success: boolean, error: string|null}}
 */
export function actualizarPublicacion(publicacionId, cambios) {
	const { user } = getCurrentUser();
	if (!user) {
		return { success: false, error: 'Debes iniciar sesión' };
	}

	const db = getDB();
	const publicacionIndex = db.publicaciones.findIndex(p => p.id === publicacionId);

	if (publicacionIndex === -1) {
		return { success: false, error: 'Publicación no encontrada' };
	}

	const publicacion = db.publicaciones[publicacionIndex];

	// Verificar permisos
	if (publicacion.usuarioId !== user.id) {
		return { success: false, error: 'No tienes permiso para editar esta publicación' };
	}

	// Aplicar cambios permitidos
	const camposEditables = ['titulo', 'categoria', 'visibilidad', 'descripcion', 'estado'];
	Object.keys(cambios).forEach(key => {
		if (camposEditables.includes(key) && cambios[key] !== undefined) {
			publicacion[key] = cambios[key];
		}
	});

	publicacion.actualizadoEn = new Date().toISOString();
	db.publicaciones[publicacionIndex] = publicacion;
	saveDB(db);

	return { success: true, error: null };
}

/**
 * Elimina una publicación
 * @param {number} publicacionId - ID de la publicación
 * @returns {{success: boolean, error: string|null}}
 */
export function eliminarPublicacion(publicacionId) {
	const { user } = getCurrentUser();
	if (!user) {
		return { success: false, error: 'Debes iniciar sesión' };
	}

	const db = getDB();
	const publicacionIndex = db.publicaciones.findIndex(p => p.id === publicacionId);

	if (publicacionIndex === -1) {
		return { success: false, error: 'Publicación no encontrada' };
	}

	const publicacion = db.publicaciones[publicacionIndex];

	// Verificar permisos
	if (publicacion.usuarioId !== user.id) {
		return { success: false, error: 'No tienes permiso para eliminar esta publicación' };
	}

	db.publicaciones.splice(publicacionIndex, 1);
	saveDB(db);

	return { success: true, error: null };
}

/**
 * Obtiene las publicaciones de un usuario
 * @param {number} userId - ID del usuario
 * @param {Object} filtros - Filtros opcionales
 * @returns {Array} Publicaciones del usuario
 */
export function getPublicacionesUsuario(userId, filtros = {}) {
	const db = getDB();
	let publicaciones = db.publicaciones.filter(p => p.usuarioId === userId);

	// Aplicar filtros
	if (filtros.estado) {
		publicaciones = publicaciones.filter(p => p.estado === filtros.estado);
	}

	if (filtros.categoria) {
		publicaciones = publicaciones.filter(p => p.categoria === filtros.categoria);
	}

	if (filtros.visibilidad) {
		publicaciones = publicaciones.filter(p => p.visibilidad === filtros.visibilidad);
	}

	// Ordenar por fecha más reciente
	publicaciones.sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));

	return publicaciones;
}

/**
 * Obtiene publicaciones públicas (feed)
 * @param {Object} filtros - Filtros opcionales
 * @returns {Array} Publicaciones públicas
 */
export function getPublicacionesPublicas(filtros = {}) {
	const db = getDB();
	let publicaciones = db.publicaciones.filter(p =>
		p.estado === 'publicado' &&
		p.visibilidad === 'publico'
	);

	// Aplicar filtros
	if (filtros.categoria && filtros.categoria !== 'todos') {
		publicaciones = publicaciones.filter(p => p.categoria === filtros.categoria);
	}

	if (filtros.busqueda) {
		const busqueda = filtros.busqueda.toLowerCase();
		publicaciones = publicaciones.filter(p => {
			const enTitulo = p.titulo.toLowerCase().includes(busqueda);
			const enDescripcion = (p.descripcion || '').toLowerCase().includes(busqueda);
			return enTitulo || enDescripcion;
		});
	}

	if (filtros.usuarioId) {
		publicaciones = publicaciones.filter(p => p.usuarioId === filtros.usuarioId);
	}

	// Ordenar por fecha más reciente
	publicaciones.sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));

	return publicaciones;
}

/**
 * Da/quita like a una publicación
 * @param {number} publicacionId - ID de la publicación
 * @returns {{success: boolean, error: string|null, liked: boolean}}
 */
export function toggleLike(publicacionId) {
	const { user } = getCurrentUser();
	if (!user) {
		return { success: false, error: 'Debes iniciar sesión para dar like', liked: false };
	}

	const db = getDB();
	const publicacion = db.publicaciones.find(p => p.id === publicacionId);

	if (!publicacion) {
		return { success: false, error: 'Publicación no encontrada', liked: false };
	}

	// Asegurar que likes existe
	if (!Array.isArray(publicacion.likes)) {
		publicacion.likes = [];
	}

	const likeIndex = publicacion.likes.indexOf(user.id);
	let liked = false;

	if (likeIndex >= 0) {
		// Quitar like
		publicacion.likes.splice(likeIndex, 1);
		liked = false;
	} else {
		// Dar like
		publicacion.likes.push(user.id);
		liked = true;
	}

	saveDB(db);

	return { success: true, error: null, liked };
}

/**
 * Agrega un comentario a una publicación
 * @param {number} publicacionId - ID de la publicación
 * @param {string} texto - Texto del comentario
 * @returns {{success: boolean, error: string|null, comentario: Object|null}}
 */
export function agregarComentario(publicacionId, texto) {
	const { user } = getCurrentUser();
	if (!user) {
		return { success: false, error: 'Debes iniciar sesión para comentar', comentario: null };
	}

	const textoLimpio = texto.trim();
	if (!textoLimpio) {
		return { success: false, error: 'El comentario no puede estar vacío', comentario: null };
	}

	if (textoLimpio.length > 1000) {
		return { success: false, error: 'El comentario es demasiado largo (máximo 1000 caracteres)', comentario: null };
	}

	const db = getDB();
	const publicacion = db.publicaciones.find(p => p.id === publicacionId);

	if (!publicacion) {
		return { success: false, error: 'Publicación no encontrada', comentario: null };
	}

	// Asegurar que comentarios existe
	if (!Array.isArray(publicacion.comentarios)) {
		publicacion.comentarios = [];
	}

	const comentario = {
		id: Date.now(),
		userId: user.id,
		autor: user.nombre,
		texto: textoLimpio,
		creadoEn: new Date().toISOString()
	};

	publicacion.comentarios.push(comentario);
	saveDB(db);

	return { success: true, error: null, comentario };
}

/**
 * Elimina un comentario
 * @param {number} publicacionId - ID de la publicación
 * @param {number} comentarioId - ID del comentario
 * @returns {{success: boolean, error: string|null}}
 */
export function eliminarComentario(publicacionId, comentarioId) {
	const { user } = getCurrentUser();
	if (!user) {
		return { success: false, error: 'Debes iniciar sesión' };
	}

	const db = getDB();
	const publicacion = db.publicaciones.find(p => p.id === publicacionId);

	if (!publicacion) {
		return { success: false, error: 'Publicación no encontrada' };
	}

	if (!Array.isArray(publicacion.comentarios)) {
		return { success: false, error: 'No hay comentarios' };
	}

	const comentarioIndex = publicacion.comentarios.findIndex(c => c.id === comentarioId);
	if (comentarioIndex === -1) {
		return { success: false, error: 'Comentario no encontrado' };
	}

	const comentario = publicacion.comentarios[comentarioIndex];

	// Solo el autor del comentario o el autor de la publicación pueden eliminarlo
	if (comentario.userId !== user.id && publicacion.usuarioId !== user.id) {
		return { success: false, error: 'No tienes permiso para eliminar este comentario' };
	}

	publicacion.comentarios.splice(comentarioIndex, 1);
	saveDB(db);

	return { success: true, error: null };
}

/**
 * Obtiene estadísticas de un usuario
 * @param {number} userId - ID del usuario
 * @returns {Object} Estadísticas
 */
export function getEstadisticasUsuario(userId) {
	const publicaciones = getPublicacionesUsuario(userId);

	const publicadas = publicaciones.filter(p => p.estado === 'publicado').length;
	const borradores = publicaciones.filter(p => p.estado === 'borrador').length;
	const archivadas = publicaciones.filter(p => p.estado === 'archivado').length;

	const fotos = publicaciones.filter(p => p.categoria === 'foto').length;
	const pinturas = publicaciones.filter(p => p.categoria === 'pintura').length;
	const documentos = publicaciones.filter(p => p.categoria === 'documento').length;

	const totalArchivos = publicaciones.reduce((acc, p) => {
		const imagenes = Array.isArray(p.imagenes) ? p.imagenes.length : 0;
		const docs = Array.isArray(p.documentos) ? p.documentos.length : 0;
		return acc + imagenes + docs;
	}, 0);

	const totalLikes = publicaciones.reduce((acc, p) => {
		return acc + (Array.isArray(p.likes) ? p.likes.length : 0);
	}, 0);

	const totalComentarios = publicaciones.reduce((acc, p) => {
		return acc + (Array.isArray(p.comentarios) ? p.comentarios.length : 0);
	}, 0);

	return {
		totalPublicaciones: publicaciones.length,
		publicadas,
		borradores,
		archivadas,
		fotos,
		pinturas,
		documentos,
		totalArchivos,
		totalLikes,
		totalComentarios
	};
}
