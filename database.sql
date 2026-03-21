CREATE DATABASE IF NOT EXISTS nube_gallery_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nube_gallery_db;


CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  correo VARCHAR(160) NOT NULL,
  contrasena_hash VARCHAR(255) NOT NULL,
  bio VARCHAR(500) NULL,
  avatar_url VARCHAR(500) NULL,
  rol ENUM('usuario', 'curador', 'admin') NOT NULL DEFAULT 'usuario',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_login_en DATETIME NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_usuarios_correo UNIQUE (correo),
  CONSTRAINT chk_usuarios_correo_len CHECK (CHAR_LENGTH(correo) >= 6)
);

CREATE INDEX idx_usuarios_nombre ON usuarios(nombre);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);

CREATE TABLE IF NOT EXISTS sesiones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL,
  ip_origen VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  expira_en DATETIME NOT NULL,
  revocada TINYINT(1) NOT NULL DEFAULT 0,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_sesiones_token UNIQUE (token),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX idx_sesiones_expira ON sesiones(expira_en);

CREATE TABLE IF NOT EXISTS publicaciones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  titulo VARCHAR(180) NOT NULL,
  categoria ENUM('foto', 'pintura', 'documento') NOT NULL,
  visibilidad ENUM('publico', 'privado', 'solo-curadores') NOT NULL DEFAULT 'publico',
  descripcion TEXT NULL,
  estado ENUM('borrador', 'publicado', 'archivado') NOT NULL DEFAULT 'publicado',
  publicado_en DATETIME NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eliminado_en DATETIME NULL,
  CONSTRAINT fk_publicaciones_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT chk_publicaciones_titulo_len CHECK (CHAR_LENGTH(titulo) >= 3)
);

CREATE INDEX idx_publicaciones_usuario ON publicaciones(usuario_id);
CREATE INDEX idx_publicaciones_estado_visibilidad ON publicaciones(estado, visibilidad);
CREATE INDEX idx_publicaciones_categoria ON publicaciones(categoria);
CREATE INDEX idx_publicaciones_publicado_en ON publicaciones(publicado_en);


CREATE TABLE IF NOT EXISTS archivos_publicacion (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  publicacion_id BIGINT UNSIGNED NOT NULL,
  tipo ENUM('imagen', 'documento') NOT NULL,
  nombre_original VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  tamano_bytes BIGINT UNSIGNED NOT NULL,
  url_archivo VARCHAR(500) NULL,
  contenido_base64 LONGTEXT NULL,
  orden_visual SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_archivos_publicacion FOREIGN KEY (publicacion_id)
    REFERENCES publicaciones(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT chk_archivos_fuente CHECK (
    (url_archivo IS NOT NULL) OR (contenido_base64 IS NOT NULL)
  )
);

CREATE INDEX idx_archivos_publicacion ON archivos_publicacion(publicacion_id);
CREATE INDEX idx_archivos_tipo ON archivos_publicacion(tipo);


CREATE TABLE IF NOT EXISTS reacciones_publicacion (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  publicacion_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  tipo ENUM('like') NOT NULL DEFAULT 'like',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reacciones_publicacion FOREIGN KEY (publicacion_id)
    REFERENCES publicaciones(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_reacciones_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT uq_reaccion_unica UNIQUE (publicacion_id, usuario_id, tipo)
);

CREATE INDEX idx_reacciones_publicacion ON reacciones_publicacion(publicacion_id);
CREATE INDEX idx_reacciones_usuario ON reacciones_publicacion(usuario_id);


CREATE TABLE IF NOT EXISTS comentarios_publicacion (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  publicacion_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  comentario TEXT NOT NULL,
  editado TINYINT(1) NOT NULL DEFAULT 0,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eliminado_en DATETIME NULL,
  CONSTRAINT fk_comentarios_publicacion FOREIGN KEY (publicacion_id)
    REFERENCES publicaciones(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_comentarios_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT chk_comentario_len CHECK (CHAR_LENGTH(comentario) >= 1)
);

CREATE INDEX idx_comentarios_publicacion ON comentarios_publicacion(publicacion_id);
CREATE INDEX idx_comentarios_usuario ON comentarios_publicacion(usuario_id);
CREATE INDEX idx_comentarios_fecha ON comentarios_publicacion(creado_en);

CREATE OR REPLACE VIEW vw_feed_publico AS
SELECT
  p.id AS publicacion_id,
  p.titulo,
  p.categoria,
  p.descripcion,
  p.publicado_en,
  p.creado_en,
  u.id AS autor_id,
  u.nombre AS autor_nombre,
  (
    SELECT COUNT(*)
    FROM reacciones_publicacion r
    WHERE r.publicacion_id = p.id
      AND r.tipo = 'like'
  ) AS total_likes,
  (
    SELECT COUNT(*)
    FROM comentarios_publicacion c
    WHERE c.publicacion_id = p.id
      AND c.eliminado_en IS NULL
  ) AS total_comentarios
FROM publicaciones p
INNER JOIN usuarios u ON u.id = p.usuario_id
WHERE p.estado = 'publicado'
  AND p.visibilidad = 'publico'
  AND p.eliminado_en IS NULL
  AND u.activo = 1;
