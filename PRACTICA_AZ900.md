# Práctica AZ-900: Aprovisionamiento de Servicios Azure
**Nube Gallery - Gestión de Galería Fotográfica**

---

## 📊 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                   USUARIO (Navegador)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │   STATIC WEB APPS (archiveddata)                   │    │
│  │   ✓ Frontend: HTML, CSS, JavaScript               │    │
│  │   ✓ URL: https://mango-cliff-027b8e610...         │    │
│  │   ✓ Autenticación y visualización de datos        │    │
│  └────────────────┬─────────────────────────────────┘    │
│                   │ HTTP/REST API                         │
│                   ▼                                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │   AZURE FUNCTIONS (func-nubegallery-jaramc)        │    │
│  │   ✓ Backend: Lógica de negocio serverless         │    │
│  │   ✓ Endpoints: /Login, /Registro, /Publicaciones │    │
│  │   ✓ Autenticación, validaciones, transformaciones│    │
│  └────────────────┬─────────────────────────────────┘    │
│                   │ SQL Queries                           │
│                   ▼                                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │   AZURE SQL DATABASE                               │    │
│  │   ✓ Persistencia: Usuarios, Publicaciones         │    │
│  │   ✓ Integridad y seguridad de datos                │    │
│  │   ✓ Backup automático                              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌐 SERVICIO 1: Azure Static Web Apps

### ¿Qué hace este servicio?

Azure Static Web Apps es un servicio que **aloja y despliega aplicaciones web estáticas** (HTML, CSS, JavaScript). Sirve archivos directamente a los usuarios sin necesidad de servidores tradicionales, permitiendo:

- ✅ Despliegue automático desde GitHub
- ✅ HTTPS seguro en todos los dominios
- ✅ Caché global de contenido
- ✅ Integración con APIs backend (Azure Functions)
- ✅ Manejo de rutas SPA (Single Page Application)

### Configuraciones elegidas y justificación

| Configuración | Valor | Justificación |
|---|---|---|
| **Nombre** | `archiveddata` | Identificador único del servicio en Azure |
| **Región** | `Central US` | Ubicación geográfica optimizada para latencia en Latinoamérica |
| **Plan** | `Free` | Suficiente para desarrollo y pruebas; incluye 100 GB/mes de ancho de banda |
| **Ubicación de app** | `/` (raíz) | El repositorio tiene index.html en la raíz del proyecto |
| **API location** | Vacío | La API está en Azure Functions (servicio separado) |
| **Output location** | Vacío | No hay proceso de build; archivos están listos |
| **Rama principal** | `main` | Rama de producción; cada push a main re-deploya automáticamente |
| **Repositorio** | GitHub: `Jaramc/nube_gallery` | Control de versiones y CI/CD automático |

### Datos técnicos

- **URL pública:** `https://mango-cliff-027b8e610.1.azurestaticapps.net/`
- **Protocolo:** HTTPS (certificado automático)
- **Tipo de aplicación:** SPA (Single Page Application)
- **Archivos servidos:** 
  - `index.html` (home/feed)
  - `loguin.html` (login)
  - `admin.html` (panel admin)
  - `dasbord.htm` (dashboard)
  - `/assets/css/styles.css`
  - `/assets/js/config.js`, `auth.js`, `database.js`, etc.

### Workflow de despliegue

El archivo `.github/workflows/azure-static-web-apps.yml` genera automáticamente:
1. Git push a rama `main` → dispara workflow
2. GitHub Actions descarga los archivos
3. Copia a Static Web Apps
4. Publica en URL pública
5. Disponible globalmente en ~1-2 minutos

---

## ⚡ SERVICIO 2: Azure Functions

### ¿Qué hace este servicio?

Azure Functions es una **plataforma de computación sin servidor (serverless)** que ejecuta código bajo demanda. Para Nube Gallery:

- ✅ Procesa solicitudes de autenticación (Login/Registro)
- ✅ Valida credenciales contra Azure SQL Database
- ✅ Gestiona sesiones de usuario
- ✅ Retorna datos de publicaciones (GET `/api/Publicaciones`)
- ✅ Recibe nuevas publicaciones (POST `/api/Publicaciones`)
- ✅ Solo cobra cuando se ejecuta (consumo real)

### Configuraciones elegidas y justificación

| Configuración | Valor | Justificación |
|---|---|---|
| **Nombre Function App** | `func-nubegallery-jaramc` | Identificador único; el sufijo "jaramc" individualiza por estudiante |
| **Región** | `Central US` | Misma que Static Web Apps y SQL Database (latencia mínima) |
| **Plan de hospedaje** | `Consumption` | Serverless puro; paga solo por ejecuciones, ideal para estudiantes |
| **Runtime stack** | Node.js v16+ (*estándar*) | Compatible con JavaScript/TypeScript |
| **Sistema operativo** | `Linux` | Más económico que Windows |
| **Almacenamiento** | Azure Storage Account | Para logs y state (si fuera necesario) |
| **Monitoreo** | Application Insights | Rastrea errores y performance |

### Endpoints implementados

```
POST /api/Registro
├─ Body: { nombre, correo, contrasena }
├─ Valida datos
├─ Hashea contraseña
├─ Inserta en SQL
└─ Retorna: { usuario, token }

POST /api/Login
├─ Body: { correo, contrasena }
├─ Busca usuario en SQL
├─ Verifica contraseña
└─ Retorna: { usuario, token }

GET /api/Publicaciones
├─ Retorna todas las publicaciones visibles
└─ Conecta a SQL Database

POST /api/Publicaciones
├─ Body: { titulo, categoria, descripcion, usuario_id }
├─ Valida usuario tiene sesión activa
├─ Inserta en SQL
└─ Retorna: { publicacion }
```

### Datos técnicos

- **URL base:** `https://func-nubegallery-jaramc.azurewebsites.net/api`
- **Tipo:** HTTP Triggered Functions
- **Timeout:** 5 minutos (default)
- **Memoria:** 128 MB a 1.5 GB (auto-escalable)
- **Precio:** ~$0.20 USD / millón de ejecuciones (Free tier: 1M gratis/mes)

### Integración con Static Web Apps

El JavaScript del frontend llama directamente:
```javascript
// En assets/js/config.js
API_BASE: 'https://func-nubegallery-jaramc.azurewebsites.net/api'

// En assets/js/auth.js
fetch(`${CONFIG.API_BASE}/Login`, {
  method: 'POST',
  body: JSON.stringify({ correo, contrasena })
})
```

---

## 🗄️ SERVICIO 3: Azure SQL Database

### ¿Qué hace este servicio?

Azure SQL Database es una **base de datos relacional completamente administrada** que proporciona:

- ✅ Almacenamiento persistente de datos estructurados
- ✅ Integridad referencial (relaciones entre tablas)
- ✅ Backup automático y redundancia
- ✅ Seguridad (encriptación en tránsito y reposo)
- ✅ Escalabilidad automática según carga
- ✅ Para Nube Gallery: Usuarios, Publicaciones, Sesiones

### Configuraciones elegidas y justificación

| Configuración | Valor | Justificación |
|---|---|---|
| **Nombre BD** | `nube_gallery_db` | Refleja propósito: datos de Nube Gallery |
| **Servidor SQL** | `sqlserver-nubegallery-jaramc` | Host del servidor (región Central US) |
| **Región** | `Central US` | Misma que Functions y Static Web Apps |
| **Autenticación** | SQL Authentication | Usuario/contraseña; más simple para desarrollo |
| **Tier de servicio** | `Basic` | 5 DTU; suficiente para práctica y pruebas |
| **Almacenamiento** | 5 GB | Límite del plan Basic; suficiente para demo |
| **Backup** | Automático (7 días) | Redundancia geográfica vs. catástrofes |
| **Firewall** | Permitir servicios Azure | Las Functions pueden acceder sin IP estática |
| **Cifrado** | TDE (Transparent Data Encryption) | Encriptación automática en reposo |

### Esquema de datos

```sql
-- Tabla de Usuarios
CREATE TABLE Usuarios (
  id INT PRIMARY KEY IDENTITY,
  nombre VARCHAR(120) NOT NULL,
  correo VARCHAR(255) UNIQUE NOT NULL,
  contrasena_hash VARCHAR(255) NOT NULL,
  fecha_creacion DATETIME DEFAULT GETDATE(),
  activo BIT DEFAULT 1
);

-- Tabla de Publicaciones
CREATE TABLE Publicaciones (
  id INT PRIMARY KEY IDENTITY,
  usuario_id INT NOT NULL FOREIGN KEY REFERENCES Usuarios(id),
  titulo VARCHAR(180) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(50),
  visibilidad VARCHAR(20) DEFAULT 'privada', -- privada, publica
  fecha_creacion DATETIME DEFAULT GETDATE()
);

-- Tabla de Imágenes (futuro)
CREATE TABLE Imagenes (
  id INT PRIMARY KEY IDENTITY,
  publicacion_id INT NOT NULL FOREIGN KEY REFERENCES Publicaciones(id),
  url_blob VARCHAR(500),
  fecha_carga DATETIME DEFAULT GETDATE()
);
```

### Datos técnicos

- **Tipo BD:** SQL Server (T-SQL)
- **Ubicación:** Central US
- **Hostname:** `sqlserver-nubegallery-jaramc.database.windows.net`
- **DTU (Database Transaction Units):** 5 (Basic)
- **Máx. conexiones simultáneas:** 30
- **Almacenamiento máximo:** 5 GB
- **Costo:** ~$5 USD/mes (tier Basic)
- **Backup retenido:** 7 días automáticos

### Integración con Azure Functions

Las Functions ejecutan queries como:

```javascript
// En función /api/Login
SELECT * FROM Usuarios 
WHERE correo = @correo AND contrasena_hash = HASHBYTES('SHA2_256', @contrasena)

// En función /api/Publicaciones (GET)
SELECT p.*, u.nombre FROM Publicaciones p
JOIN Usuarios u ON p.usuario_id = u.id
WHERE p.visibilidad = 'publica'
ORDER BY p.fecha_creacion DESC
```

---

## 🔄 Flujo de datos: Ejemplo (Registro de usuario)

```
1. Usuario escribe datos en loguin.html
   └─ Nombre: "Ximena", Correo: "x@mail.com", Contraseña: "Seg123!"

2. JavaScript (auth.js) valida localmente
   └─ Formato correo ✓, Fortaleza contraseña ✓

3. Llamada HTTP POST a Azure Functions
   └─ POST https://func-nubegallery-jaramc.azurewebsites.net/api/Registro
   └─ Body: { nombre, correo, contrasena }

4. Azure Functions recibe y procesa
   ├─ Hashea contraseña con bcrypt
   ├─ Prepara INSERT a SQL Database
   └─ Ejecuta query

5. Azure SQL Database almacena
   └─ INSERT INTO Usuarios VALUES (...)

6. SQL retorna ID de usuario
   └─ { id: 42, nombre: "Ximena", correo: "x@mail.com" }

7. Functions retorna al frontend
   └─ { success: true, usuario: { id, nombre, correo } }

8. Static Web Apps guarda en localStorage
   └─ localStorage.setItem('nube_gallery_current_user', user)

9. Usuario redirigido a index.html (feed)
   └─ LISTO ✓
```

---

## 📈 Matriz de Decisiones

| Aspecto | Decisión | Alternativa Rechazada | Razón |
|---|---|---|---|
| **Frontend** | Static Web Apps | App Service | SWA = más simple, auto-deploy desde GitHub |
| **Backend** | Azure Functions | App Service | Functions = serverless, pago por uso, ideal estudiantes |
| **BD** | Azure SQL | Cosmos DB | SQL = relacional, datos estructurados, costo menor |
| **Plan SWA** | Free | Standard | Free suficiente para desarrollo; costo $0 |
| **Plan Functions** | Consumption | Premium | Consumption = sin costo mínimo; escala automática |
| **Plan SQL** | Basic | Standard | Basic suficiente para pruebas; costo ~$5/mes |
| **Región** | Central US | East US | Central más cercana a Latinoamérica |
| **Autenticación SQL** | SQL User | Azure AD | SQL simpler para estudiantes; AD para producción |

---

## ✅ Estado Actual

- ✅ Static Web Apps: **ACTIVA** (desplegando desde GitHub Actions)
- ✅ Azure Functions: **CONFIGURADA** (endpoints listos en código)
- ✅ Azure SQL Database: **LISTA** (esquema y conexión establecida)
- ✅ Integración: **COMPLETA** (frontend ↔ Functions ↔ SQL)

---

## 🎯 Conclusión

Nube Gallery implementa una **arquitectura moderna serverless** donde:

1. **Static Web Apps** entrega la interfaz al usuario
2. **Azure Functions** procesa lógica sin gestionar servidores
3. **Azure SQL Database** persiste datos de forma segura y escalable

Esta arquitectura es **económica para desarrollo**, **escalable automáticamente** y sigue **buenas prácticas empresariales**.

