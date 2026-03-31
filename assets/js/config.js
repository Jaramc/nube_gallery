/**
 * Configuración global de Nube Gallery
 * @module config
 */

export const CONFIG = {
	// Claves de localStorage
	KEYS: {
		DB: 'nube_gallery_db',
		CURRENT_USER: 'nube_gallery_current_user',
		THEME: 'nube_gallery_theme',
		LAST_ACTIVITY: 'nube_gallery_last_activity'
	},

	// Configuración de sesión
	SESSION: {
		TIMEOUT_MINUTES: 60,
		CHECK_INTERVAL: 60000 // 1 minuto
	},

	// Límites de archivos
	FILE_LIMITS: {
		MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
		MAX_DOCUMENT_SIZE: 10 * 1024 * 1024, // 10MB
		MAX_IMAGES_PER_POST: 10,
		MAX_DOCUMENTS_PER_POST: 5,
		ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
		ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
	},

	// Configuración de validación
	VALIDATION: {
		MIN_PASSWORD_LENGTH: 8,
		MIN_TITULO_LENGTH: 3,
		MAX_TITULO_LENGTH: 180,
		MIN_NOMBRE_LENGTH: 2,
		MAX_BIO_LENGTH: 500
	},

	// Usuarios demo
	DEMO_USERS: [
		{ id: 900001, nombre: 'Luna Mar', correo: 'luna.mar@nube.demo', contrasena: 'demo12345' },
		{ id: 900002, nombre: 'Tomás Azul', correo: 'tomas.azul@nube.demo', contrasena: 'demo12345' },
		{ id: 900003, nombre: 'Carla Óleo', correo: 'carla.oleo@nube.demo', contrasena: 'demo12345' }
	],

	// Imágenes de ejemplo
	SEED_IMAGES: ['flor_loto.jpg', 'paint1.jpg', 'paint2.jpg', 'paint4.jpg', 'paint5.jpg', 'paint6.jpg']
};

/**
 * Configuración de Tailwind CSS
 */
export const TAILWIND_CONFIG = {
	theme: {
		extend: {
			colors: {
				arena: '#c7b5a5',
				taupe: '#a69281',
				cielo: '#8ec9eb',
				mar: '#38a8bf',
				oceano: '#0f7e8d',
				noche: '#061633',
				tinta: '#eaf6ff'
			},
			fontFamily: {
				display: ['Poppins', 'Segoe UI', 'sans-serif'],
				body: ['Nunito', 'Segoe UI', 'sans-serif']
			},
			boxShadow: {
				suave: '0 18px 45px rgba(8, 30, 57, 0.35)'
			},
			keyframes: {
				fadeUp: {
					'0%': { opacity: '0', transform: 'translateY(18px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				slideIn: {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(0)' }
				},
				spin: {
					'0%': { transform: 'rotate(0deg)' },
					'100%': { transform: 'rotate(360deg)' }
				}
			},
			animation: {
				fadeUp: 'fadeUp 700ms ease-out both',
				fadeIn: 'fadeIn 500ms ease-out both',
				slideIn: 'slideIn 400ms ease-out both',
				spin: 'spin 1s linear infinite'
			}
		}
	}
};
