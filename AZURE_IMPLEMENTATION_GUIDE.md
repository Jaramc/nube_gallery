# Guía de Implementación de Servicios Azure

Esta guía proporciona el paso a paso para implementar 4 escenarios diferentes en Microsoft Azure, cada uno con un objetivo específico.

## Tabla de Contenidos
- [Escenario 1: Pipeline de Datos ETL](#escenario-1-pipeline-de-datos-etl)
- [Escenario 2: Reportería Corporativa](#escenario-2-reportería-corporativa)
- [Escenario 3: API NoSQL Serverless](#escenario-3-api-nosql-serverless)
- [Escenario 4: Base de Datos con Observabilidad](#escenario-4-base-de-datos-con-observabilidad)

---

## Escenario 1: Pipeline de Datos ETL

**Servicios:** Storage Account + Azure Data Factory + Azure Databricks
**Objetivo:** Pipeline de datos ETL (Extracción, Transformación y Carga)

### Prerrequisitos
- Cuenta de Azure activa
- Suscripción con permisos de Contributor o superior
- Azure CLI instalado (opcional pero recomendado)

### Paso 1: Crear Storage Account

1. Inicia sesión en el [Portal de Azure](https://portal.azure.com)
2. Haz clic en **"Crear un recurso"**
3. Busca **"Storage Account"** y selecciónalo
4. Configura los siguientes parámetros:
   - **Suscripción:** Selecciona tu suscripción
   - **Grupo de recursos:** Crea uno nuevo llamado `rg-etl-pipeline`
   - **Nombre de la cuenta:** `stgpipelineetl[tunombre]` (debe ser único globalmente)
   - **Región:** Selecciona la más cercana (ej: East US)
   - **Rendimiento:** Standard
   - **Redundancia:** LRS (Locally Redundant Storage)
5. Haz clic en **"Revisar y crear"** y luego **"Crear"**

#### Configurar Contenedores
1. Una vez creado, ve al Storage Account
2. En el menú izquierdo, selecciona **"Contenedores"**
3. Crea tres contenedores:
   - `raw-data` (para datos sin procesar)
   - `processed-data` (para datos procesados)
   - `archived-data` (para datos archivados)

### Paso 2: Crear Azure Data Factory

1. En el Portal de Azure, haz clic en **"Crear un recurso"**
2. Busca **"Data Factory"** y selecciónalo
3. Configura:
   - **Suscripción:** Tu suscripción
   - **Grupo de recursos:** `rg-etl-pipeline` (el mismo creado antes)
   - **Región:** La misma que el Storage Account
   - **Nombre:** `adf-pipeline-etl-[tunombre]`
   - **Versión:** V2
4. Haz clic en **"Revisar y crear"** y luego **"Crear"**
5. Una vez creado, haz clic en **"Abrir Azure Data Factory Studio"**

### Paso 3: Crear Azure Function App

1. En el Portal de Azure, haz clic en **"Crear un recurso"**
2. Busca **"Function App"** y selecciónalo
3. Configura:
   - **Suscripción:** Tu suscripción
   - **Grupo de recursos:** `rg-etl-pipeline`
   - **Nombre:** `func-etl-transformation-[tunombre]`
   - **Publish:** Code
   - **Runtime stack:** Python
   - **Versión:** 3.11
   - **Región:** La misma región que Storage Account y Data Factory
   - **Plan de hospedaje:** Consumption (Serverless)
   - **Sistema operativo:** Linux
4. Haz clic en **"Revisar y crear"** y luego **"Crear"**

> **Nota:** Azure Functions es más ligero que Databricks y perfecto para transformaciones ETL, especialmente para cuentas estudiantiles

### Paso 4: Configurar el Pipeline ETL

#### En Azure Data Factory:
1. Abre Azure Data Factory Studio
2. Haz clic en el icono de **"Author"** (lápiz)
3. Crea un nuevo **"Pipeline"**:
   - Nombre: `ETL_Pipeline_Main`
4. Crea **Linked Services**:
   - **Para Storage Account:**
     - Ve a **"Manage"** > **"Linked Services"**
     - Haz clic en **"+ New"**
     - Selecciona **"Azure Blob Storage"**
     - Nombre: `LS_StorageAccount`
     - Método de autenticación: Account Key
     - Selecciona tu Storage Account
     - Haz clic en **"Test connection"** para verificar
   - **Para Azure Function:**
     - Haz clic en **"+ New"**
     - Busca y selecciona **"Azure Function"**
     - Nombre: `LS_AzureFunction`
     - Selecciona tu Function App del desplegable
     - Haz clic en **"Test connection"** para verificar

5. Crea **Datasets**:
   - Dataset de origen: Conectado al contenedor `raw-data`
   - Dataset de destino: Conectado al contenedor `processed-data`

6. En el Pipeline, agrega actividades:
   - **Copy Data Activity:** Para extraer datos desde `raw-data`
   - **Azure Function Activity:** Para transformar datos
   - **Copy Data Activity:** Para cargar datos procesados a `processed-data`

7. Publica los cambios

### Paso 5: Crear Función HTTP en Azure Function App

1. Ve a tu Function App creada
2. En el menú izquierdo, haz clic en **"Functions"**
3. Haz clic en **"+ Create"**
4. Selecciona **"HTTP trigger"**:
   - **Nombre:** `TransformData`
   - **Authorization level:** Function
5. Haz clic en **"Create"**

#### Código de transformación (Python):

1. En tu función `TransformData`, ve a **"Code + Test"**
2. Reemplaza el código con:

```python
import azure.functions as func
from azure.storage.blob import BlobServiceClient
import csv
from io import StringIO
import os

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        # Obtener connection string desde variables de entorno
        connection_string = os.environ.get("AzureWebJobsStorage")
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)

        # Leer datos del contenedor raw-data
        container_client = blob_service_client.get_container_client("raw-data")
        blobs = list(container_client.list_blobs())

        for blob in blobs:
            blob_client = container_client.get_blob_client(blob.name)
            data = blob_client.download_blob().readall().decode('utf-8')

            # Transformaciones: limpiar datos
            lines = data.split('\n')
            reader = csv.DictReader(lines)
            cleaned_data = []

            for row in reader:
                if row and any(row.values()):  # Eliminar filas vacías
                    cleaned_data.append(row)

            # Guardar datos limpios en processed-data
            output_container = blob_service_client.get_container_client("processed-data")
            output_blob_client = output_container.get_blob_client(f"processed_{blob.name}")

            # Convertir a CSV string
            if cleaned_data:
                output = StringIO()
                writer = csv.DictWriter(output, fieldnames=cleaned_data[0].keys())
                writer.writeheader()
                writer.writerows(cleaned_data)
                output_blob_client.upload_blob(output.getvalue(), overwrite=True)

        return func.HttpResponse("Transformación completada exitosamente", status_code=200)

    except Exception as e:
        return func.HttpResponse(f"Error en transformación: {str(e)}", status_code=500)
```

3. Haz clic en **"Save"**

#### Personalizar la transformación:

Puedes modificar la lógica de transformación en la sección de comentario `# Transformaciones`:

```python
# Ejemplo: Filtrar columnas específicas
for row in reader:
    if row:
        filtered_row = {k: v for k, v in row.items() if k in ["column1", "column2"]}
        cleaned_data.append(filtered_row)

# Ejemplo: Filtrar por condición
for row in reader:
    if row and float(row.get("column1", 0)) > 100:
        cleaned_data.append(row)
```

### Paso 6: Ejecutar y Monitorear el Pipeline

1. En Data Factory Studio, ve a tu pipeline `ETL_Pipeline_Main`
2. Asegúrate de que las actividades estén conectadas correctamente:
   - Copy Data (origen) → Azure Function → Copy Data (destino)
3. Haz clic en **"Debug"** o **"Trigger"** > **"Trigger Now"**
4. Monitorea la ejecución en la sección **"Monitor"**
5. Verifica que los datos transformados aparezcan en el contenedor `processed-data`

#### Verificar resultados:

1. Ve a tu Storage Account
2. En **"Contenedores"**, abre `processed-data`
3. Deberías ver archivos con el prefijo `processed_` con los datos limpios

#### Solución de problemas:

Si hay errores:
1. Ve a tu Function App → **"Functions"** → **`TransformData`** → **"Monitor"**
2. Revisa los logs para ver detalles del error
3. Verifica que la variable de entorno `AzureWebJobsStorage` esté configurada correctamente

---

## Escenario 2: Reportería Corporativa

**Servicios:** Azure SQL Database + Azure Data Factory + Power BI
**Objetivo:** Sistema de reportería corporativa

### Paso 1: Crear Azure SQL Database

1. En el Portal de Azure, haz clic en **"Crear un recurso"**
2. Busca **"SQL Database"** y selecciónalo
3. Configura:
   - **Suscripción:** Tu suscripción
   - **Grupo de recursos:** Crea uno nuevo `rg-reporteria-corporativa`
   - **Nombre de la base de datos:** `sqldb-reportes`
   - **Servidor:** Crea uno nuevo:
     - Nombre del servidor: `sqlserver-reportes-[tunombre]`
     - Ubicación: Tu región preferida
     - Autenticación: SQL Authentication
     - Usuario administrador: `sqladmin`
     - Contraseña: (usa una contraseña segura)
   - **¿Desea usar el grupo elástico de SQL?** No
   - **Proceso y almacenamiento:** Basic (5 DTU, 2 GB) para pruebas
4. En la pestaña **"Redes"**:
   - Método de conectividad: Public endpoint
   - Permitir servicios de Azure: Sí
   - Agregar tu dirección IP actual: Sí
5. Haz clic en **"Revisar y crear"** y luego **"Crear"**

### Paso 2: Configurar la Base de Datos

1. Una vez creada, ve a la base de datos
2. Haz clic en **"Editor de consultas"**
3. Inicia sesión con las credenciales configuradas
4. Crea tablas de ejemplo:

```sql
-- Tabla de ventas
CREATE TABLE Sales (
    SaleID INT PRIMARY KEY IDENTITY(1,1),
    ProductName NVARCHAR(100),
    Category NVARCHAR(50),
    SaleAmount DECIMAL(10,2),
    SaleDate DATE,
    Region NVARCHAR(50)
);

-- Insertar datos de ejemplo
INSERT INTO Sales (ProductName, Category, SaleAmount, SaleDate, Region)
VALUES
    ('Laptop', 'Electronics', 1200.00, '2026-01-15', 'North'),
    ('Mouse', 'Electronics', 25.00, '2026-01-16', 'South'),
    ('Desk', 'Furniture', 350.00, '2026-01-17', 'East'),
    ('Chair', 'Furniture', 150.00, '2026-01-18', 'West');
```

### Paso 3: Configurar Azure Data Factory

1. Crea un nuevo Data Factory (si no existe):
   - **Grupo de recursos:** `rg-reporteria-corporativa`
   - **Nombre:** `adf-reporteria`
2. Abre Data Factory Studio
3. Crea **Linked Service** para SQL Database:
   - Type: Azure SQL Database
   - Nombre: `LS_AzureSQL`
   - Selecciona tu servidor y base de datos
   - Autenticación: SQL Authentication
4. Crea un **Pipeline** para actualizar datos periódicamente:
   - Nombre: `PL_UpdateReports`
   - Agrega actividades según tus necesidades (Copy Data, Stored Procedure, etc.)

### Paso 4: Conectar Power BI

#### Opción A: Power BI Desktop (Local)

1. Descarga e instala [Power BI Desktop](https://powerbi.microsoft.com/desktop/)
2. Abre Power BI Desktop
3. Haz clic en **"Obtener datos"** > **"Azure"** > **"Azure SQL Database"**
4. Configura la conexión:
   - **Servidor:** `sqlserver-reportes-[tunombre].database.windows.net`
   - **Base de datos:** `sqldb-reportes`
   - Modo de conectividad de datos: **Import** o **DirectQuery**
5. Ingresa las credenciales (SQL Authentication)
6. Selecciona las tablas necesarias (ej: Sales)
7. Haz clic en **"Cargar"**

#### Crear Visualizaciones:
1. Crea un nuevo **"Informe"**
2. Arrastra campos a las visualizaciones:
   - Gráfico de barras: Ventas por Región
   - Gráfico circular: Ventas por Categoría
   - KPI: Total de ventas
   - Tabla: Detalle de ventas
3. Guarda el informe

#### Opción B: Power BI Service (Nube)

1. Ve a [Power BI Service](https://app.powerbi.com)
2. Inicia sesión con tu cuenta
3. Crea un nuevo **"Conjunto de datos"**
4. Selecciona **"Azure SQL Database"**
5. Configura la conexión (similar a la Opción A)
6. Crea informes y dashboards en línea

### Paso 5: Automatizar Actualización de Datos

1. En Power BI Desktop, ve a **"Inicio"** > **"Actualizar"** para actualizar manualmente
2. Para automático:
   - Publica el informe a Power BI Service
   - Ve a **"Configuración"** del conjunto de datos
   - Configura **"Actualización programada"**
   - Establece la frecuencia (diaria, semanal, etc.)

### Paso 6: Compartir Reportes

1. En Power BI Service, abre tu informe
2. Haz clic en **"Compartir"**
3. Ingresa correos electrónicos de usuarios
4. O crea un **"Dashboard"** y compártelo con tu organización

---

## Escenario 3: API NoSQL Serverless

**Servicios:** Cosmos DB + Azure Functions + API Management
**Objetivo:** API NoSQL serverless escalable

### Paso 1: Crear Azure Cosmos DB

1. En el Portal de Azure, haz clic en **"Crear un recurso"**
2. Busca **"Azure Cosmos DB"** y selecciónalo
3. Selecciona **"Core (SQL)"** API
4. Configura:
   - **Suscripción:** Tu suscripción
   - **Grupo de recursos:** Crea uno nuevo `rg-api-nosql`
   - **Nombre de cuenta:** `cosmosdb-api-[tunombre]`
   - **Ubicación:** Tu región preferida
   - **Modo de capacidad:** Serverless (para cargas variables)
   - **Redundancia geográfica:** Deshabilitado (para pruebas)
5. Haz clic en **"Revisar y crear"** y luego **"Crear"**

### Paso 2: Configurar Cosmos DB

1. Una vez creado, ve a tu cuenta de Cosmos DB
2. En **"Data Explorer"**, haz clic en **"New Container"**:
   - **Database id:** Crea nueva `ProductsDB`
   - **Container id:** `Products`
   - **Partition key:** `/category`
3. Inserta datos de ejemplo:
   - Haz clic en **"Items"** en tu contenedor
   - Haz clic en **"New Item"**
   - Inserta:

```json
{
    "id": "1",
    "name": "Laptop HP",
    "category": "Electronics",
    "price": 1200,
    "stock": 50
}
```

4. Ve a **"Keys"** y copia la **Primary Connection String** (la necesitarás)

### Paso 3: Crear Azure Functions

1. En el Portal de Azure, haz clic en **"Crear un recurso"**
2. Busca **"Function App"** y selecciónalo
3. Configura:
   - **Suscripción:** Tu suscripción
   - **Grupo de recursos:** `rg-api-nosql`
   - **Nombre de la aplicación de funciones:** `func-api-products-[tunombre]`
   - **¿Desea implementar código o imagen de contenedor?** Code
   - **Pila del entorno en tiempo de ejecución:** Node.js, Python, o .NET
   - **Versión:** Última disponible
   - **Región:** La misma región
   - **Sistema operativo:** Linux
   - **Tipo de plan:** Consumption (Serverless)
4. Haz clic en **"Revisar y crear"** y luego **"Crear"**

### Paso 4: Crear Funciones HTTP

1. Ve a tu Function App creada
2. Haz clic en **"Functions"** en el menú izquierdo
3. Haz clic en **"+ Create"**
4. Selecciona **"HTTP trigger"**:
   - **Nombre:** `GetProducts`
   - **Authorization level:** Function
5. Haz clic en **"Create"**

#### Ejemplo de código (Node.js):

1. Haz clic en tu función `GetProducts`
2. Ve a **"Code + Test"**
3. Reemplaza el código con:

```javascript
const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    const client = new CosmosClient({ endpoint, key });

    const database = client.database("ProductsDB");
    const container = database.container("Products");

    try {
        const { resources: items } = await container.items
            .query("SELECT * FROM c")
            .fetchAll();

        context.res = {
            status: 200,
            body: items
        };
    } catch (error) {
        context.res = {
            status: 500,
            body: "Error retrieving products: " + error.message
        };
    }
};
```

#### Crear más funciones:
- `CreateProduct` (POST)
- `UpdateProduct` (PUT)
- `DeleteProduct` (DELETE)

### Paso 5: Configurar Variables de Entorno

1. En tu Function App, ve a **"Configuration"**
2. Haz clic en **"+ New application setting"**
3. Agrega:
   - **Name:** `COSMOS_ENDPOINT`
   - **Value:** `https://cosmosdb-api-[tunombre].documents.azure.com:443/`
4. Agrega otra:
   - **Name:** `COSMOS_KEY`
   - **Value:** (tu Primary Key de Cosmos DB)
5. Haz clic en **"Save"**

### Paso 6: Crear API Management

1. En el Portal de Azure, haz clic en **"Crear un recurso"**
2. Busca **"API Management"** y selecciónalo
3. Configura:
   - **Suscripción:** Tu suscripción
   - **Grupo de recursos:** `rg-api-nosql`
   - **Región:** Tu región
   - **Nombre del recurso:** `apim-products-[tunombre]`
   - **Nombre de la organización:** Tu organización
   - **Correo del administrador:** Tu correo
   - **Plan de tarifa:** Consumption (para desarrollo)
4. Haz clic en **"Revisar y crear"** y luego **"Crear"** (puede tardar ~45 min)

### Paso 7: Importar Azure Functions a API Management

1. Ve a tu API Management service
2. En el menú izquierdo, selecciona **"APIs"**
3. Haz clic en **"+ Add API"**
4. Selecciona **"Function App"**
5. Haz clic en **"Browse"** y selecciona tu Function App
6. Selecciona las funciones que deseas exponer
7. Configura:
   - **Display name:** Products API
   - **Name:** products-api
   - **URL scheme:** HTTPS
8. Haz clic en **"Create"**

### Paso 8: Configurar Políticas y Seguridad

1. En tu API, selecciona una operación (ej: GetProducts)
2. Haz clic en **"+ Add policy"** en Inbound processing
3. Agrega políticas según necesites:
   - **Rate limiting:** Para limitar llamadas
   - **CORS:** Para permitir acceso desde web
   - **Validate JWT:** Para autenticación

Ejemplo de política CORS:
```xml
<policies>
    <inbound>
        <cors>
            <allowed-origins>
                <origin>*</origin>
            </allowed-origins>
            <allowed-methods>
                <method>GET</method>
                <method>POST</method>
            </allowed-methods>
        </cors>
    </inbound>
</policies>
```

### Paso 9: Probar la API

1. En API Management, selecciona tu API
2. Ve a la pestaña **"Test"**
3. Selecciona una operación (ej: GetProducts)
4. Haz clic en **"Send"**
5. Verifica la respuesta

También puedes usar Postman o curl:
```bash
curl -X GET "https://apim-products-[tunombre].azure-api.net/products" \
     -H "Ocp-Apim-Subscription-Key: {tu-subscription-key}"
```

---

## Escenario 4: Base de Datos con Observabilidad

**Servicios:** Azure SQL Database + Azure Backup + Azure Monitor
**Objetivo:** Base de datos con respaldos y observabilidad completa

### Paso 1: Crear Azure SQL Database

1. En el Portal de Azure, haz clic en **"Crear un recurso"**
2. Busca **"SQL Database"** y selecciónalo
3. Configura:
   - **Suscripción:** Tu suscripción
   - **Grupo de recursos:** Crea uno nuevo `rg-sql-observability`
   - **Nombre de la base de datos:** `sqldb-production`
   - **Servidor:** Crea uno nuevo:
     - Nombre: `sqlserver-prod-[tunombre]`
     - Ubicación: Tu región
     - Autenticación: SQL + Azure AD
     - Usuario: `sqladmin`
     - Contraseña: (contraseña segura)
   - **Proceso y almacenamiento:** Standard S1 (20 DTU)
4. En **"Opciones adicionales"**:
   - **Usar datos existentes:** Sample (para tabla de ejemplo)
5. Haz clic en **"Revisar y crear"** y luego **"Crear"**

### Paso 2: Configurar Azure Backup

#### Respaldos Automáticos (Ya incluidos):
Azure SQL Database incluye respaldos automáticos:
- **Respaldo completo:** Semanalmente
- **Respaldo diferencial:** Cada 12-24 horas
- **Respaldo de registro de transacciones:** Cada 5-10 minutos
- **Retención:** 7-35 días (configurable)

#### Configurar Retención:
1. Ve a tu base de datos SQL
2. En el menú izquierdo, selecciona **"Copia de seguridad"**
3. Haz clic en **"Configurar políticas"**
4. Configura:
   - **Retención de copia de seguridad en puntos:** 7-35 días
   - **Retención de copia semanal:** Hasta 12 semanas
   - **Retención de copia mensual:** Hasta 12 meses
   - **Retención de copia anual:** Hasta 10 años
5. Haz clic en **"Aplicar"**

#### Restaurar desde un Backup:
1. Ve a tu base de datos SQL
2. Haz clic en **"Restaurar"**
3. Selecciona el punto de restauración
4. Configura el nombre de la nueva base de datos
5. Haz clic en **"Revisar y crear"**

### Paso 3: Configurar Azure Monitor

#### Habilitar Diagnósticos:
1. Ve a tu SQL Database
2. En el menú izquierdo, selecciona **"Configuración de diagnóstico"**
3. Haz clic en **"+ Agregar configuración de diagnóstico"**
4. Configura:
   - **Nombre:** `diag-sqldb-production`
   - **Categorías de registro:**
     - ✅ SQLInsights
     - ✅ AutomaticTuning
     - ✅ QueryStoreRuntimeStatistics
     - ✅ QueryStoreWaitStatistics
     - ✅ Errors
     - ✅ DatabaseWaitStatistics
     - ✅ Timeouts
     - ✅ Blocks
     - ✅ Deadlocks
   - **Métricas:**
     - ✅ Basic
     - ✅ InstanceAndAppAdvanced
     - ✅ WorkloadManagement
   - **Detalles del destino:**
     - ✅ Enviar a Log Analytics workspace (crea uno nuevo si no existe)
     - Nombre: `log-analytics-sql`
5. Haz clic en **"Guardar"**

### Paso 4: Crear Alertas

1. Ve a tu SQL Database
2. En el menú izquierdo, selecciona **"Alertas"**
3. Haz clic en **"+ Crear"** > **"Regla de alertas"**

#### Alerta 1: CPU alta
1. En **"Condición"**:
   - Señal: **CPU percentage**
   - Lógica de alerta:
     - Operador: Mayor que
     - Umbral: 80
     - Agregar cada: 5 minutos
2. En **"Acciones"**:
   - Crea un nuevo grupo de acciones
   - Nombre: `action-group-sql-alerts`
   - Agrega una acción de tipo Email/SMS
3. En **"Detalles"**:
   - Nombre: `alert-cpu-high`
   - Gravedad: Warning (1)
4. Haz clic en **"Revisar y crear"**

#### Alerta 2: Uso de almacenamiento
1. Crea otra alerta
2. Señal: **Storage percentage**
3. Umbral: > 90%

#### Alerta 3: Conexiones fallidas
1. Crea otra alerta
2. Señal: **Failed Connections**
3. Umbral: > 10 en 5 minutos

### Paso 5: Crear Dashboard de Monitoreo

1. Ve a [Azure Portal](https://portal.azure.com)
2. Haz clic en **"Dashboard"** en el menú superior
3. Haz clic en **"+ Nuevo dashboard"**
4. Nombre: `SQL Database Monitoring`
5. Haz clic en **"+ Agregar icono"**

#### Agregar métricas:
1. Agrega el icono **"Métricas"**
2. Configura:
   - **Recurso:** Tu SQL Database
   - **Métrica:** CPU percentage
   - **Agregación:** Avg
3. Repite para otras métricas:
   - DTU percentage
   - Storage percentage
   - Connections (successful/failed)
   - Deadlocks
   - Sessions

4. Agrega el icono **"Alertas"** para ver alertas activas
5. Guarda el dashboard

### Paso 6: Configurar Azure Log Analytics Queries

1. Ve a tu Log Analytics Workspace
2. Haz clic en **"Registros"** en el menú izquierdo
3. Ejecuta consultas útiles:

#### Consulta 1: Top 10 consultas más lentas
```kusto
AzureDiagnostics
| where Category == "QueryStoreRuntimeStatistics"
| summarize avg(duration_d) by query_hash_s
| top 10 by avg_duration_d desc
```

#### Consulta 2: Errores en las últimas 24 horas
```kusto
AzureDiagnostics
| where Category == "Errors"
| where TimeGenerated > ago(24h)
| summarize count() by error_severity_s, error_message_s
| order by count_ desc
```

#### Consulta 3: Conexiones por hora
```kusto
AzureDiagnostics
| where MetricName == "connection_successful"
| summarize sum(total_d) by bin(TimeGenerated, 1h)
| render timechart
```

4. Guarda las consultas útiles haciendo clic en **"Guardar"**

### Paso 7: Configurar Application Insights (Opcional)

Para monitoreo de aplicaciones que usan la BD:

1. Crea un recurso **"Application Insights"**
2. Integra con tu aplicación usando el SDK
3. Relaciona logs de aplicación con métricas de base de datos

### Paso 8: Implementar Auditoría

1. Ve a tu SQL Server
2. En el menú izquierdo, selecciona **"Auditoría"**
3. Activa **"Habilitar auditoría de Azure SQL"**
4. Configura:
   - **Destino de auditoría:** Storage Account
   - **Storage Account:** Crea o selecciona uno
   - **Período de retención:** 90 días
   - **Eventos a auditar:**
     - BATCH_COMPLETED_GROUP
     - SUCCESSFUL_DATABASE_AUTHENTICATION_GROUP
     - FAILED_DATABASE_AUTHENTICATION_GROUP
5. Haz clic en **"Guardar"**

### Paso 9: Pruebas y Validación

1. **Probar Alertas:**
   - Genera carga en la base de datos
   - Verifica que lleguen notificaciones

2. **Verificar Backups:**
   - Intenta restaurar un backup de prueba
   - Valida que los datos sean correctos

3. **Revisar Logs:**
   - Ve a Log Analytics
   - Verifica que se estén recolectando logs

4. **Dashboard:**
   - Revisa el dashboard
   - Asegúrate de que las métricas se actualicen

---

## Costos Aproximados

### Escenario 1: Pipeline ETL
- Storage Account (Standard LRS, 100GB): ~$2/mes
- Azure Data Factory: ~$0.50/1000 pipeline activities
- Azure Functions (Consumption, hasta 1M ejecuciones gratis): Gratis o ~$0.20/mes
- **Total estimado: ~$2-3/mes** (ideal para estudiantes)

### Escenario 2: Reportería
- Azure SQL Database (Basic): ~$5/mes
- Data Factory: ~$1/mes
- Power BI Pro: $10/usuario/mes
- **Total estimado: ~$16+/mes**

### Escenario 3: API NoSQL
- Cosmos DB (Serverless, 10GB, 1M RU): ~$0.30/mes
- Azure Functions (Consumption, 1M ejecuciones): Gratis
- API Management (Consumption): $0.035/10K llamadas
- **Total estimado: ~$5-10/mes**

### Escenario 4: Observabilidad
- Azure SQL Database (Standard S1): ~$30/mes
- Azure Backup: Incluido
- Azure Monitor (Log Analytics, 5GB): ~$10/mes
- **Total estimado: ~$40/mes**

---

## Mejores Prácticas

1. **Seguridad:**
   - Usa Azure AD para autenticación cuando sea posible
   - Implementa Network Security Groups (NSG)
   - Habilita cifrado en reposo y en tránsito
   - Usa Azure Key Vault para secretos

2. **Monitoreo:**
   - Configura alertas relevantes
   - Revisa logs regularmente
   - Crea dashboards personalizados

3. **Costos:**
   - Usa tags para organizar recursos
   - Implementa Azure Cost Management
   - Revisa recomendaciones de Azure Advisor
   - Apaga recursos no utilizados

4. **Performance:**
   - Implementa índices apropiados en bases de datos
   - Usa caché cuando sea posible
   - Configura auto-scaling para cargas variables

5. **Respaldos:**
   - Prueba restauraciones periódicamente
   - Documenta procedimientos de disaster recovery
   - Implementa geo-redundancia para producción

---

## Recursos Adicionales

- [Documentación oficial de Azure](https://docs.microsoft.com/azure/)
- [Azure Architecture Center](https://docs.microsoft.com/azure/architecture/)
- [Microsoft Learn](https://docs.microsoft.com/learn/)
- [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)

---

## Soporte

Para preguntas o problemas:
- Revisa la documentación oficial
- Consulta [Azure Support](https://azure.microsoft.com/support/)
- Comunidad en [Microsoft Q&A](https://docs.microsoft.com/answers/)

---

**Fecha de creación:** Marzo 2026
**Versión:** 1.0
