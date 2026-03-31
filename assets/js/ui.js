/**
 * Módulo de componentes y utilidades de UI
 * @module ui
 */

import { escapeHTML } from './utils.js';

/**
 * Muestra un mensaje toast/notification
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: success, error, warning, info
 * @param {number} duration - Duración en ms
 */
export function showToast(message, type = 'info', duration = 3000) {
	// Remover toasts existentes
	const existingToast = document.querySelector('.nube-toast');
	if (existingToast) {
		existingToast.remove();
	}

	const toast = document.createElement('div');
	toast.className = 'nube-toast';

	const colors = {
		success: 'bg-green-500',
		error: 'bg-red-500',
		warning: 'bg-yellow-500',
		info: 'bg-cielo'
	};

	const icons = {
		success: '✓',
		error: '✕',
		warning: '⚠',
		info: 'ℹ'
	};

	toast.innerHTML = `
		<div class="fixed bottom-6 right-6 z-50 animate-fadeUp">
			<div class="${colors[type]} text-white px-6 py-4 rounded-lg shadow-suave flex items-center gap-3 max-w-md">
				<span class="text-2xl">${icons[type]}</span>
				<span class="text-sm font-semibold">${escapeHTML(message)}</span>
			</div>
		</div>
	`;

	document.body.appendChild(toast);

	setTimeout(() => {
		toast.style.opacity = '0';
		toast.style.transform = 'translateY(20px)';
		toast.style.transition = 'all 300ms ease-out';
		setTimeout(() => toast.remove(), 300);
	}, duration);
}

/**
 * Muestra un modal de confirmación
 * @param {string} title - Título del modal
 * @param {string} message - Mensaje
 * @param {string} confirmText - Texto del botón confirmar
 * @param {string} cancelText - Texto del botón cancelar
 * @returns {Promise<boolean>} True si se confirma
 */
export function showConfirm(title, message, confirmText = 'Confirmar', cancelText = 'Cancelar') {
	return new Promise((resolve) => {
		const modal = document.createElement('div');
		modal.className = 'nube-modal';
		modal.innerHTML = `
			<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn" data-modal-backdrop>
				<div class="bg-noche border border-white/20 rounded-2xl shadow-suave max-w-md w-full mx-4 animate-fadeUp">
					<div class="p-6">
						<h3 class="text-2xl font-display font-bold text-tinta mb-3">${escapeHTML(title)}</h3>
						<p class="text-slate-200/80">${escapeHTML(message)}</p>
					</div>
					<div class="flex gap-3 p-6 pt-0">
						<button data-action="cancel" class="flex-1 px-4 py-3 rounded-lg border border-white/20 text-slate-200 font-semibold hover:bg-white/10 transition">
							${escapeHTML(cancelText)}
						</button>
						<button data-action="confirm" class="flex-1 px-4 py-3 rounded-lg bg-mar text-noche font-bold hover:bg-cielo transition">
							${escapeHTML(confirmText)}
						</button>
					</div>
				</div>
			</div>
		`;

		document.body.appendChild(modal);

		const backdrop = modal.querySelector('[data-modal-backdrop]');
		const confirmBtn = modal.querySelector('[data-action="confirm"]');
		const cancelBtn = modal.querySelector('[data-action="cancel"]');

		const cleanup = (result) => {
			modal.remove();
			resolve(result);
		};

		confirmBtn.addEventListener('click', () => cleanup(true));
		cancelBtn.addEventListener('click', () => cleanup(false));
		backdrop.addEventListener('click', (e) => {
			if (e.target === backdrop) cleanup(false);
		});

		// Cerrar con ESC
		const handleEscape = (e) => {
			if (e.key === 'Escape') {
				document.removeEventListener('keydown', handleEscape);
				cleanup(false);
			}
		};
		document.addEventListener('keydown', handleEscape);
	});
}

/**
 * Muestra un loading spinner
 * @param {string} message - Mensaje opcional
 * @returns {Function} Función para ocultar el spinner
 */
export function showLoading(message = 'Cargando...') {
	const loading = document.createElement('div');
	loading.className = 'nube-loading';
	loading.innerHTML = `
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
			<div class="bg-noche border border-white/20 rounded-2xl shadow-suave p-8 text-center">
				<div class="animate-spin h-12 w-12 border-4 border-cielo border-t-transparent rounded-full mx-auto mb-4"></div>
				<p class="text-tinta font-semibold">${escapeHTML(message)}</p>
			</div>
		</div>
	`;

	document.body.appendChild(loading);

	return () => loading.remove();
}

/**
 * Crea un elemento con clases y contenido
 * @param {string} tag - Tag HTML
 * @param {Object} options - Opciones
 * @returns {HTMLElement} Elemento creado
 */
export function createElement(tag, { classes = [], attrs = {}, children = [], html = '', text = '' } = {}) {
	const element = document.createElement(tag);

	if (classes.length) {
		element.className = classes.join(' ');
	}

	Object.entries(attrs).forEach(([key, value]) => {
		element.setAttribute(key, value);
	});

	if (html) {
		element.innerHTML = html;
	}

	if (text) {
		element.textContent = text;
	}

	children.forEach(child => {
		if (child instanceof HTMLElement) {
			element.appendChild(child);
		}
	});

	return element;
}

/**
 * Muestra un indicador de progreso en un elemento
 * @param {HTMLElement} element - Elemento donde mostrar progreso
 * @param {number} progress - Progreso (0-100)
 */
export function showProgress(element, progress) {
	if (!element) return;

	let progressBar = element.querySelector('.nube-progress-bar');
	if (!progressBar) {
		progressBar = document.createElement('div');
		progressBar.className = 'nube-progress-bar h-2 bg-cielo/30 rounded-full overflow-hidden mt-2';
		progressBar.innerHTML = '<div class="nube-progress-fill h-full bg-cielo transition-all duration-300" style="width: 0%"></div>';
		element.appendChild(progressBar);
	}

	const fill = progressBar.querySelector('.nube-progress-fill');
	fill.style.width = `${Math.min(100, Math.max(0, progress))}%`;

	if (progress >= 100) {
		setTimeout(() => progressBar.remove(), 500);
	}
}

/**
 * Añade un listener de submit a un formulario con validación
 * @param {HTMLFormElement} form - Formulario
 * @param {Function} onSubmit - Callback al enviar
 * @param {Function} validate - Función de validación opcional
 */
export function setupForm(form, onSubmit, validate = null) {
	if (!form) return;

	form.addEventListener('submit', async (e) => {
		e.preventDefault();

		// Deshabilitar botón de submit
		const submitBtn = form.querySelector('button[type="submit"]');
		const originalText = submitBtn ? submitBtn.textContent : '';
		if (submitBtn) {
			submitBtn.disabled = true;
			submitBtn.classList add('opacity-50', 'cursor-not-allowed');
		}

		try {
			const formData = new FormData(form);
			const data = Object.fromEntries(formData.entries());

			// Validación personalizada
			if (validate) {
				const validation = validate(data);
				if (!validation.valid) {
					showToast(validation.error, 'error');
					return;
				}
			}

			// Ejecutar callback
			await onSubmit(data, form);
		} catch (error) {
			console.error('Error en formulario:', error);
			showToast('Ocurrió un error al procesar el formulario', 'error');
		} finally {
			// Rehabilitar botón
			if (submitBtn) {
				submitBtn.disabled = false;
				submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
			}
		}
	});
}

/**
 * Agrega animación de entrada a elementos
 * @param {string} selector - Selector CSS
 * @param {number} delay - Delay entre elementos (ms)
 */
export function animateIn(selector, delay = 100) {
	const elements = document.querySelectorAll(selector);
	elements.forEach((el, index) => {
		el.style.animationDelay = `${index * delay}ms`;
		el.classList.add('animate-fadeUp');
	});
}

/**
 * Scroll suave a un elemento
 * @param {string|HTMLElement} target - Selector o elemento
 * @param {number} offset - Offset en pixels
 */
export function scrollTo(target, offset = 0) {
	const element = typeof target === 'string' ? document.querySelector(target) : target;
	if (!element) return;

	const y = element.getBoundingClientRect().top + window.pageYOffset - offset;
	window.scrollTo({ top: y, behavior: 'smooth' });
}
