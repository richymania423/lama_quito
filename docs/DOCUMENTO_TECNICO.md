# L.A.M.A. Capítulo Quito · Portal del Secretario
## Documento técnico: definiciones, funcionalidades y manual de instalación

| | |
|---|---|
| **Sistema** | Portal web de gestión del capítulo (socios, asambleas, asistencia, documentación) |
| **Sitio publicado** | https://richymania423.github.io/lama_quito/ |
| **Repositorio** | https://github.com/richymania423/lama_quito (rama `main`) |
| **Tipo** | Aplicación web estática (SPA) + Supabase como backend |
| **Idioma de la interfaz** | Español |
| **Desarrollado por** | Za.Tho |

> Este documento describe el sistema **tal como está en el código**. Las limitaciones y riesgos conocidos están en la sección 11. Las funciones se revisaron leyendo el código y con pruebas automáticas parciales en Node; **no hay pruebas de interfaz en navegador ni en dispositivos móviles registradas**.

---

## Índice

1. Resumen y alcance
2. Arquitectura
3. Estructura del proyecto
4. Modelo de datos
5. Seguridad, roles y permisos
6. Funcionalidades por módulo
7. Documentos PDF generados
8. Interfaz y compatibilidad
9. Manual técnico de instalación
10. Operación y mantenimiento
11. Limitaciones conocidas y recomendaciones
12. Glosario

---

## 1. Resumen y alcance

El portal sustituye el trabajo manual del secretario del capítulo. Permite:

- Llevar el **registro de socios** con foto, datos personales, rango y acceso al sistema.
- Registrar **copilotos** y **motocicletas** de cada socio, mostrados como árbol bajo el socio.
- Programar **asambleas** con orden del día y generar la **convocatoria** en PDF.
- Registrar la **asistencia** y generar el **acta** en PDF.
- Consultar el **cuadro anual** con indicadores de participación y exportarlos a PDF.
- Mostrar la **Directiva de Capítulo** con fotos.
- Mantener un repositorio de **Documentación** (estatutos, reglamentos, actas, otros).
- Controlar el acceso por **cédula y contraseña** con tres roles.

No incluye envío de mensajes (por ejemplo WhatsApp) por decisión expresa del cliente.

---

## 2. Arquitectura

```
┌──────────────────────────┐        HTTPS         ┌─────────────────────────────────┐
│ Navegador (PC/Android/   │ ───────────────────► │ GitHub Pages                    │
│ iPhone)                  │   HTML/CSS/JS        │ (sitio estático, rama main)     │
│  - index.html + js/*.js  │                      └─────────────────────────────────┘
│  - jsPDF (CDN)           │
│  - supabase-js (CDN)     │        HTTPS         ┌─────────────────────────────────┐
│                          │ ───────────────────► │ Supabase                        │
└──────────────────────────┘   API REST / Auth /  │  - PostgreSQL (tablas + RLS)    │
                               Storage / Functions│  - Auth (usuarios)              │
                                                  │  - Storage (fotos, documentos)  │
                                                  │  - Edge Function bright-handler │
                                                  └─────────────────────────────────┘
```

| Capa | Tecnología | Función |
|---|---|---|
| Interfaz | HTML5, CSS3, JavaScript sin frameworks | Una sola página; las vistas se alternan con la clase `active` |
| Hosting | GitHub Pages + GitHub Actions | Publica el sitio en cada `push` a `main` |
| Datos | Supabase (PostgreSQL) | Tablas, claves foráneas y reglas RLS |
| Autenticación | Supabase Auth | Login por cédula con email sintético `<cedula>@lama.app` |
| Archivos | Supabase Storage | Buckets privados `fotos-socios` y `documentos` |
| Administración de accesos | Supabase Edge Function (Deno) | Crea, actualiza y elimina usuarios con la clave `service_role` |
| PDF | jsPDF 2.5.1 + jspdf-autotable 3.8.2 | Se generan en el navegador |

**Librerías externas cargadas por CDN** (el equipo del usuario necesita internet):

- `@supabase/supabase-js@2` (jsDelivr)
- `jspdf 2.5.1` y `jspdf-autotable 3.8.2` (cdnjs)

**Flujo de configuración.** `js/config.js` define `window.APP_CONFIG` con la URL y la clave pública de Supabase. Ese archivo **no está en el repositorio** (`.gitignore`). En producción lo genera el workflow de GitHub Actions a partir de los *secrets* del repositorio.

---

## 3. Estructura del proyecto

```
lama_quito/
├── index.html                  Interfaz completa (login, menú, vistas, modal)
├── css/styles.css              Estilos (incluye vista móvil y árbol de socios)
├── images/logo_lama_quito.png  Logo del capítulo
├── fonts/CinzelDecorative-Bold.ttf   Tipografía de la convocatoria PDF
├── js/
│   ├── config.js               (NO versionado) URL y anon key de Supabase
│   ├── config.example.js       Plantilla de config.js
│   ├── auth.js                 Login, roles, permisos, clave personal
│   ├── db.js                   Capa de datos (único punto de acceso a Supabase)
│   ├── app.js                  Navegación, modal, toast, dashboard, respaldo, menú, login
│   ├── socios.js               Socios + árbol de copilotos y motos
│   ├── copilotos.js            Formulario y borrado de copilotos
│   ├── motos.js                Formulario y borrado de motocicletas
│   ├── asambleas.js            Asambleas y orden del día
│   ├── asistencia.js           Asamblea en curso: asistencia y temas
│   ├── cuadro.js               Cuadro anual e indicadores
│   ├── directiva.js            Directiva de Capítulo
│   ├── documentos.js           Módulo Documentación
│   └── pdf.js                  Acta, convocatoria e indicadores en PDF
├── docs/                       Scripts SQL, Edge Function y guías
├── .github/workflows/deploy.yml  Despliegue a GitHub Pages
├── .gitignore
├── LICENSE                     MIT
└── README.md
```

**Orden de carga de scripts** (todos con `defer`): `config`, `auth`, `db`, `socios`, `asambleas`, `asistencia`, `cuadro`, `directiva`, `documentos`, `copilotos`, `motos`, `pdf`, `app`.

**Objetos globales:** `Auth`, `DB`, `UI`, `Menu`, `Dashboard`, `Socios`, `Asambleas`, `Asistencia`, `Cuadro`, `Directiva`, `Documentacion`, `Copilotos`, `Motos`, `PDF`.

**Capa de datos.** Toda la comunicación con Supabase pasa por `DB` (`js/db.js`). La interfaz usa `camelCase` y la base usa `snake_case`; `db.js` hace el mapeo. Los identificadores son texto generados en el navegador (`Date.now()` en base 36 + aleatorio).

---

## 4. Modelo de datos

### 4.1 Tablas

**`socios`**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text, PK | |
| `nombre` | text, obligatorio | |
| `identificacion` | text | Cédula; es el usuario de acceso |
| `telefono`, `email` | text | |
| `fecha_nacimiento` | date | |
| `tipo_sangre` | text | O+, O-, A+, A-, B+, B-, AB+, AB- |
| `sector_residencia` | text | Norte, Sur, Centro, Valles |
| `foto_path` | text | Ruta en el bucket `fotos-socios` |
| `rango` | text | Restringido por `CHECK` a 9 valores (ver 6.3) |
| `activo` | boolean, por defecto `true` | |
| `creado` | timestamptz | |

Índice único parcial `socios_rango_unico`: los seis cargos de directiva solo pueden tenerlos **un** socio a la vez.

**`asambleas`**: `id`, `fecha` (date), `hora` (text), `lugar`, `mes_correspondencia`, `orden_dia` (jsonb, arreglo de textos), `temas` (text), `creado`.

**`asistencia`**: `id` = `<asambleaId>__<socioId>` (un registro por socio y asamblea), `asamblea_id` → `asambleas` (**ON DELETE CASCADE**), `socio_id` → `socios` (**ON DELETE CASCADE**), `presente` (boolean), `observacion`. Índices por asamblea y por socio.

**`perfiles`**: `id` uuid (PK, → `auth.users`, cascade), `cedula`, `nombre`, `socio_id` (→ `socios`, ON DELETE SET NULL), `rol` (`admin` | `secretario` | `lectura`), `creado`.

**`copilotos`**: `id`, `nombre` (obligatorio), `parentesco`, `tipo_sangre`, `fecha_nacimiento`, `socio_id` (→ `socios`, **ON DELETE SET NULL**), `creado`.

**`motos`**: `id`, `marca` (obligatoria), `modelo`, `color`, `anio` (integer), `cilindraje` (integer, cc), `placa` (se guarda en mayúsculas), `socio_id` (→ `socios`, **ON DELETE SET NULL**), `creado`.

**`documentos`**: `id`, `titulo` (obligatorio), `descripcion`, `categoria` (`Estatutos` | `Reglamentos` | `Actas` | `Otros`), `archivo_path`, `nombre_archivo`, `mime`, `tamano` (bytes), `subido_por` (cédula), `creado`.

### 4.2 Funciones y disparadores

- `rol_actual()`: devuelve el rol del usuario autenticado leyendo `perfiles` (`SECURITY DEFINER`). Las reglas RLS de copilotos, motos, documentos y fotos dependen de ella.
- Disparador `on_auth_user_created`: al crearse un usuario en `auth.users` crea su fila en `perfiles` con rol `lectura` y la cédula tomada de la parte local del email.

### 4.3 Almacenamiento (buckets privados)

| Bucket | Límite | Tipos | Subir/borrar | Leer |
|---|---|---|---|---|
| `fotos-socios` | 1 MB | JPEG, PNG, WEBP | Solo admin | Usuarios con sesión (URL firmada de 1 hora) |
| `documentos` | 10 MB | PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, JPG, PNG, WEBP | Admin y secretario | Usuarios con sesión (URL firmada de 5 minutos) |

### 4.4 Reglas de integridad al eliminar

| Se elimina | Efecto |
|---|---|
| Un socio | Se borra su asistencia (cascade) y su foto del bucket. Sus copilotos y motos **quedan sin asignar** |
| Una asamblea | Se borra su asistencia (cascade) |
| Un documento | Se borra la fila y luego el archivo del bucket |

---

## 5. Seguridad, roles y permisos

### 5.1 Autenticación

- El usuario ingresa **cédula** (o correo, si contiene `@`) y contraseña.
- La cédula se convierte en `<cedula>@lama.app` y se valida con Supabase Auth. El administrador puede usar un correo real.
- Tras entrar, el rol se lee de `perfiles`. Si no hay perfil, el rol es `lectura`.
- La sesión persiste en el navegador hasta pulsar **Salir**.
- Longitud mínima de contraseña: 6 caracteres.

### 5.2 Clave inicial y clave personal

1. Al dar acceso a un socio, el admin define una clave y deja marcada la casilla **"Debe cambiar esta clave al ingresar"**.
2. La Edge Function guarda `debe_cambiar_clave = true` en `user_metadata` del usuario.
3. Al ingresar, la app muestra un cuadro obligatorio **"Elige tu clave personal"** (sin botón de cierre). Exige 6 caracteres como mínimo, que coincidan las dos entradas y que sea distinta a la actual.
4. Al guardar, la marca pasa a `false` y no se vuelve a pedir.
5. El botón **Salir** del cuadro cierra la sesión; la clave sigue siendo temporal.

> La marca se aplica en el navegador. Un usuario con conocimientos técnicos podría saltarse el cuadro desde las herramientas del navegador. No es un bloqueo del servidor.

### 5.3 Matriz de roles (definida en `Auth.ROLES`)

| Módulo | Administrador | Secretario | Lectura |
|---|---|---|---|
| Inicio (dashboard) | Ver | Ver | Ver |
| Directiva de Capítulo | Ver | Ver | Ver |
| Socios (con copilotos y motos) | **Administrar** | Ver | Ver |
| Asambleas | **Administrar** | **Administrar** | No ve el módulo |
| Asistencia | **Administrar** | **Administrar** | Ver |
| Cuadro anual | Ver (y PDF) | Ver (y PDF) | Ver (y PDF) |
| Documentación | **Administrar** | **Administrar** | Ver y descargar |
| Datos y respaldo | **Administrar** | No | No |
| Gestión de accesos (en la ficha del socio) | **Sí** | No | No |

"Administrar" significa crear, editar y eliminar. Los botones se ocultan según el rol (`UI.puede(modulo)`).

### 5.4 Dónde se aplica cada restricción

| Recurso | Interfaz | Base de datos (RLS) |
|---|---|---|
| Copilotos y motos | Solo admin edita | **Solo admin** (`rol_actual() = 'admin'`) |
| Documentos (tabla y bucket) | Admin y secretario | **Admin y secretario** |
| Fotos de socios | Solo admin sube | **Solo admin** |
| Socios, asambleas, asistencia | Según tabla 5.3 | Cualquier usuario autenticado puede escribir (ver 11) |
| Perfiles | | Cada usuario lee su propio perfil |
| Gestión de usuarios | Solo admin | La Edge Function comprueba que el solicitante sea `admin` |

La clave `service_role` solo existe dentro de la Edge Function (secreto `SERVICE_KEY`) y nunca llega al navegador. La clave `anon` es pública por diseño.

---

## 6. Funcionalidades por módulo

### 6.1 Inicio (dashboard)

- Tarjetas: **total de socios**, **socios activos**, **asambleas realizadas este año** (fecha anterior a hoy) y **asistencia promedio**.
- **Cumpleañeros del mes** en curso, con foto, ordenados por día.
- **Últimas 5 asambleas** con fecha, lugar, mes y número de asistentes.
- Panel **Datos y respaldo** (solo admin), descrito en 6.9.

La asistencia promedio del Inicio es: presentes totales ÷ (nº de asambleas × nº de socios). Es un cálculo distinto al del Cuadro anual (6.6).

### 6.2 Navegación

Menú lateral oculto que se abre con el botón **Menú**. Se cierra al elegir una opción, al tocar fuera, con `Esc` y, en equipos con ratón, al sacar el puntero del panel. El encabezado muestra la sección actual, el usuario con sesión y su rol.

### 6.3 Socios

**Campos:** foto, nombre (obligatorio), identificación, teléfono, correo, fecha de nacimiento, tipo de sangre, sector de residencia, rango, estado activo, y acceso al sistema.

**Foto.** Se elige JPG, PNG o WEBP (hasta 15 MB de origen). El navegador la reduce a 400 px por lado máximo y la guarda como JPEG (calidad 0,82) con fondo blanco, para respetar el límite de 1 MB del bucket. Sin foto se muestran las iniciales.

**Rangos.** Seis cargos únicos (Presidente, Vicepresidente, Tesorero, Secretario, Oficial de Mototurismo, Gerente de Negocios) y tres repetibles (Full Color, Rocket Prospect, Prospecto). Un cargo ocupado aparece deshabilitado en la lista con el nombre de quien lo tiene. La base de datos también lo impide.

**Acceso al sistema (solo admin).** Casilla "Tiene acceso", casilla "Es secretario" (si no, queda en solo lectura), contraseña y casilla de clave temporal. Requiere que el socio tenga cédula. Al desmarcar el acceso se elimina el usuario. Si la contraseña se deja vacía al editar, no se cambia.

**Listado.** Número, nombre con foto y rango, identificación, teléfono, nacimiento, estado y acciones. Búsqueda por nombre o cédula, y también por nombre o parentesco de copiloto y por marca, modelo, color o placa de moto.

**Eliminar socio.** Borra su asistencia y su foto. Sus copilotos y motos quedan sin asignar.

### 6.4 Copilotos y motocicletas (dentro de Socios)

- Botones **👤 Ingresar copiloto** y **🏍️ Ingresar motocicleta** en la cabecera. Cada fila de socio tiene además 👤 y 🏍️ para agregar con ese socio ya elegido.
- **Copiloto:** nombre (obligatorio), parentesco (Esposo/a, Pareja, Hijo/a, Padre, Madre, Hermano/a, Amigo/a, Otro), tipo de sangre, fecha de nacimiento y socio con afinidad (opcional).
- **Motocicleta:** marca (obligatoria), modelo, color, año (1900 hasta el año siguiente), cilindraje en cc, placa y socio propietario (opcional).
- **Árbol:** bajo cada socio se listan primero sus copilotos y después sus motos, con conectores `├─` y `└─`. Los registros sin socio aparecen al final en el grupo **"Copilotos y motocicletas sin socio asignado"**.
- **Botón `+` / `−`:** los socios con ramas tienen un botón para desplegarlas u ocultarlas. Por defecto están ocultas. El estado se recuerda mientras no se recargue la página. Al buscar, todo se despliega. Al agregar un registro a un socio, su rama queda abierta.
- **Permisos:** todos consultan; solo el admin crea, edita y elimina.
- **Tolerancia a fallos:** si las tablas `copilotos` o `motos` no existen, Socios sigue funcionando sin ellas.

### 6.5 Directiva de Capítulo

Vista de solo lectura. Muestra los seis cargos con foto, nombre y cargo: Presidente y Vicepresidente en tarjetas grandes, y los otros cuatro en tarjetas normales. Un cargo sin asignar aparece como **"Vacante"**. Los cargos se toman del campo `rango` de cada socio.

### 6.6 Asambleas

- **Campos:** fecha (obligatoria, por defecto hoy), hora (por defecto 19:00), lugar, mes de correspondencia (por defecto el mes actual) y **orden del día**.
- **Orden del día:** se agregan puntos con el campo y el botón o con Enter. Se numeran automáticamente y se pueden subir, bajar o quitar.
- **Lista:** fecha, hora, lugar, mes, nº de asistentes y acciones: 📝 abrir en Asistencia, 📄 convocatoria, ✏️ editar y 🗑️ eliminar.
- **Regla:** no se puede eliminar una asamblea con fecha anterior a hoy (el botón aparece deshabilitado). Sí se puede editar. Una asamblea de hoy o futura se elimina con confirmación, y se pierden su asistencia y sus temas.
- Solo admin y secretario ven este módulo y sus botones de edición. El rol lectura no ve el módulo.

### 6.7 Asistencia (asamblea en curso)

- Selector de asamblea con el formato `<Mes> - dd/mm/aaaa`.
- Panel con los datos de la asamblea, el orden del día (solo lectura) y el botón de convocatoria en PDF, visible para todos los roles.
- **Temas principales tratados:** texto libre con botón **Guardar temas**.
- **Registro de asistencia:** lista de **socios activos** con casilla Presente y Observación. Cada cambio se guarda al instante. Botones **Marcar todos** y **Desmarcar todos**.
- **Estadísticas:** presentes, ausentes, total de socios activos y porcentaje de asistencia.
- El rol lectura ve todo, pero los campos están bloqueados.
- Botón **Generar PDF de la asamblea** (acta).

### 6.8 Cuadro anual

- Selector de año. Matriz con **todos** los socios en filas y las asambleas del año en columnas (✓ asistió, · faltó, – sin considerar), y un porcentaje por socio.
- **Asamblea considerada:** fecha menor o igual a hoy (hora local) **y** con al menos un registro de asistencia. Las demás se muestran con `–` y no penalizan a nadie.
- **Indicadores** (solo socios activos y solo asambleas consideradas):
  - **Asistencia promedio** = promedio de los porcentajes individuales, redondeado.
  - **Socios con 100 %.**
  - **Ranking de participación:** orden por asistencias y luego por nombre; los empates comparten posición; medallas 🥇🥈🥉 a las posiciones 1 a 3.
  - **Miembros más activos:** los 5 primeros con al menos una asistencia, con nota de empatados.
  - **Inasistencias recurrentes:** activos con **3 o más** faltas en el año, con las fechas en que faltaron.
- Botón **Descargar Indicadores de Participación (PDF)**.

### 6.9 Documentación

- **Categorías:** Estatutos, Reglamentos, Actas, Otros. Búsqueda por título, descripción o nombre de archivo, y filtro por categoría.
- **Subir (admin y secretario):** título (obligatorio, máx. 150), descripción (máx. 500), categoría y archivo de hasta **10 MB** (pdf, doc, docx, xls, xlsx, ppt, pptx, txt, jpg, jpeg, png, webp). Si falla el registro, el archivo subido se borra.
- **Editar:** solo título, categoría y descripción. Para cambiar el archivo hay que eliminar el documento y subir otro.
- **Ver y descargar (todos):** 👁️ abre en pestaña nueva los formatos que el navegador muestra (pdf, txt, imágenes); ⬇️ descarga. Ambos usan una URL firmada de 5 minutos.

### 6.10 Datos y respaldo (solo admin)

- **Exportar respaldo (JSON):** archivo `respaldo-lama-quitoconnect-AAAA-MM-DD.json` con `version`, `exportado`, `socios`, `asambleas` y `asistencia`.
- **Importar respaldo:** mezcla los registros por id. No borra nada y no pide confirmación.
- **Borrar todo:** pide confirmación y elimina asistencia, asambleas y socios.
- **El respaldo no incluye** copilotos, motocicletas, documentos, fotos ni usuarios. **"Borrar todo" tampoco los elimina.** Ver la sección 11.

---

## 7. Documentos PDF generados

Todos se generan en el navegador con jsPDF, tamaño A4, con pie de página "Generado el …" y numeración.

| Documento | Orientación | Archivo | Quién lo genera | Contenido principal |
|---|---|---|---|---|
| **Acta de asamblea** | Vertical | `acta-asamblea-AAAA-MM-DD.pdf` | Botón en Asistencia | Datos de la asamblea; orden del día; temas tratados; resumen de asistencia; tabla de presentes (# y nombre, con observación); tabla de ausentes con observación; una firma "Directiva LAMA Quito" |
| **Convocatoria** | Vertical | `convocatoria-asamblea-AAAA-MM-DD.pdf` | Botón en Asambleas y en Asistencia (todos los roles) | Marco decorativo, logo, título "CONVOCATORIA", texto formal con mes, lugar, fecha y hora, orden del día numerado, nota de uniforme y firma "Directiva LAMA Quito". Usa la fuente Cinzel Decorative; si no carga, usa Times |
| **Indicadores de Participación** | Horizontal | `Indicadores de Participación.pdf` | Botón en Cuadro anual | Cuatro tarjetas resumen, ranking con barras de color (verde ≥ 80 %, ámbar ≥ 50 %, rojo el resto), miembros más activos, inasistencias recurrentes y detalle por asamblea (X, ·, -) |

En la convocatoria, el año del texto se ajusta si el mes de correspondencia dista más de seis meses del mes de la fecha (por ejemplo, una asamblea de enero que corresponde a diciembre usa el año anterior).

---

## 8. Interfaz y compatibilidad

- **Navegadores:** cualquier navegador moderno en Windows, macOS, Android (Chrome) e iOS (Safari). El portal es una página web; no hay aplicación nativa.
- **Móvil:** etiqueta `viewport`, tablas con desplazamiento horizontal, formularios en una columna hasta 640 px, campos de 16 px en móvil (evita el zoom automático de Safari en iPhone) y botones de toque más grandes.
- **Pendiente de verificar en dispositivos reales:** descarga de PDF en iPhone (Safari puede abrirlo en pestaña en lugar de descargarlo), selección de foto desde galería o cámara, y manejo de la tabla de socios en pantallas pequeñas.
- **Requiere internet** (Supabase y las librerías por CDN).
- No es una PWA (no tiene `manifest` ni modo sin conexión).

---

## 9. Manual técnico de instalación

### 9.1 Requisitos

| Elemento | Detalle |
|---|---|
| Cuenta de **GitHub** | Para el repositorio y GitHub Pages (plan gratuito) |
| Cuenta de **Supabase** | Plan gratuito |
| **Git** | Para subir el código |
| Un editor de texto y un navegador moderno | |
| (Opcional) **Python** o **Node.js** | Para probar el sitio localmente |

### 9.2 Paso 1. Crear el proyecto en Supabase

1. Entra en https://supabase.com, crea un proyecto y espera a que termine de aprovisionarse.
2. Anota, en **Project Settings → API**:
   - **Project URL** (`https://xxxx.supabase.co`)
   - Clave **anon public**
3. **No uses ni copies** la clave `service_role` fuera del panel de Supabase.

### 9.3 Paso 2. Crear las tablas y los permisos

Ejecuta los scripts en **SQL Editor → New query → Run**, **en este orden** (todos se pueden repetir sin dañar los datos, salvo `supabase_schema.sql`, que crea las políticas iniciales sin `drop` y puede avisar de duplicados si se repite):

| # | Archivo (`docs/`) | Qué hace |
|---|---|---|
| 1 | `supabase_schema.sql` | Tablas `socios`, `asambleas`, `asistencia` y políticas iniciales |
| 2 | `supabase_add_socio_fields.sql` | Tipo de sangre y sector de residencia |
| 3 | `supabase_fix_rls.sql` | Corrige permisos del rol `anon` (primera fase) |
| 4 | `supabase_fix_grants_authenticated.sql` | Permisos del rol `authenticated` sobre las tablas de datos |
| 5 | `supabase_auth_perfiles.sql` | Tabla `perfiles`, función `rol_actual()` y disparador |
| 6 | `supabase_fix_perfiles_grant.sql` | Permiso de lectura de `perfiles` |
| 7 | `supabase_fix_perfiles_grant2.sql` | Permisos de `perfiles` para la Edge Function (`service_role`) |
| 8 | `supabase_rango_socios.sql` | Rango de socio y unicidad de cargos |
| 9 | `supabase_fotos_socios.sql` | Columna `foto_path` y bucket `fotos-socios` |
| 10 | `supabase_documentos.sql` | Tabla `documentos` y bucket `documentos` |
| 11 | `supabase_copilotos.sql` | Tabla `copilotos` |
| 12 | `supabase_motos.sql` | Tabla `motos` |

Los pasos 10 a 12 requieren que ya exista `rol_actual()` (paso 5). Los pasos 8 y 9 modifican `socios`.

### 9.4 Paso 3. Desplegar la Edge Function

1. Supabase → **Edge Functions → Create a new function**.
2. Nombre (slug): el que usará la aplicación. En producción actual es **`bright-handler`**. La plantilla `config.example.js` usa `gestion-usuarios`; el nombre debe coincidir con `FN_GESTION_USUARIOS`.
3. Pega el contenido completo de `docs/edge-function-gestion-usuarios.ts` y despliega.
4. Crea el secreto **`SERVICE_KEY`** con la clave `service_role` (Edge Functions → Secrets). Si no existe, la función intenta usar `SUPABASE_SERVICE_ROLE_KEY`.
5. **Debes volver a desplegar la función cada vez que cambie este archivo.** La versión actual incluye la marca de clave temporal.

**Acciones de la función** (solo para el rol `admin`): `estado_acceso`, `guardar_acceso` (con `forzarCambio`) y `quitar_acceso`.

### 9.5 Paso 4. Crear el primer administrador

1. Supabase → **Authentication → Users → Add user → Create new user**.
2. Email: la cédula del admin seguida de `@lama.app` (por ejemplo `1700000000@lama.app`), o un correo real. Marca **Auto Confirm User** y define una contraseña.
3. Sube su rol en el SQL Editor. Usa la parte local del correo como cédula:

```sql
update public.perfiles set rol = 'admin'
where cedula = '1700000000';   -- o la parte antes de @ del correo real
```

4. Desde la ficha de cada socio, el admin da acceso al resto de usuarios.

### 9.6 Paso 5. Configuración local

1. Clona o copia el proyecto.
2. Copia `js/config.example.js` como `js/config.js` y completa:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
  SUPABASE_ANON_KEY: "TU_CLAVE_ANON_PUBLIC",
  FN_GESTION_USUARIOS: "bright-handler",   // slug de tu Edge Function
};
```

3. Sirve el sitio (no abras `index.html` con doble clic):

```bash
python -m http.server 8080      # o:  npx serve .
```

4. Abre `http://localhost:8080` e ingresa con el usuario del paso 9.5.

### 9.7 Paso 6. Publicar en GitHub Pages

1. Crea el repositorio en GitHub y sube el código:

```bash
git init
git add .
git commit -m "Versión inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

2. En **Settings → Secrets and variables → Actions → New repository secret**, crea:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. En **Settings → Pages → Build and deployment → Source**, elige **GitHub Actions**.
4. Edita `.github/workflows/deploy.yml` si cambia el slug de la función (`FN_GESTION_USUARIOS`).
5. Cada `push` a `main` ejecuta el flujo "Desplegar en GitHub Pages". Tarda alrededor de un minuto. La URL queda en `https://TU_USUARIO.github.io/TU_REPO/`.

**Permisos del token de Git.** Para subir cambios al workflow, el token personal debe tener los alcances `repo` y `workflow`.

### 9.8 Lista de verificación posterior a la instalación

- [ ] Inicia sesión como admin.
- [ ] Crea un socio con foto y verifica que la foto se ve.
- [ ] Crea una asamblea con orden del día y descarga la convocatoria.
- [ ] Registra asistencia y genera el acta.
- [ ] Sube un documento y descárgalo.
- [ ] Ingresa un copiloto y una motocicleta y verifica el árbol con `+`.
- [ ] Da acceso a un socio de prueba y comprueba que se le pide la clave personal en el primer ingreso (usa una ventana privada).
- [ ] Entra con un usuario de rol lectura y comprueba que no ve botones de edición.

### 9.9 Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `permission denied for table …` | Falta un `GRANT` o una política | Ejecuta los scripts 4, 6 y 7 de la tabla 9.3 |
| Pantalla de login pero "Falta el cliente supabase-js o config.js" en consola | `config.js` ausente o incorrecto | Revisa los *secrets* y vuelve a ejecutar el despliegue |
| No se puede dar acceso a un socio | Edge Function sin desplegar, slug distinto o falta `SERVICE_KEY` | Revisa 9.4 y `FN_GESTION_USUARIOS` |
| "Tu rol es 'lectura', se requiere admin" | El usuario no está como admin en `perfiles` | Repite el `update` de 9.5 |
| No guarda copilotos, motos o documentos | No se ejecutó el script SQL correspondiente | Ejecuta los scripts 10 a 12 |
| No se pide la clave personal | Edge Function antigua | Vuelve a desplegarla con el código actual |
| Fotos como iniciales | Bucket `fotos-socios` no creado o sin políticas | Ejecuta el script 9 |
| El sitio no se actualiza | Caché del navegador o despliegue pendiente | Revisa la pestaña Actions y recarga con Ctrl+F5 |
| Error al cambiar de cédula de un socio con acceso | La cédula es el usuario | No cambiar la cédula una vez creado el acceso |

---

## 10. Operación y mantenimiento

- **Respaldos.** Además del respaldo JSON de la aplicación (que cubre solo socios, asambleas y asistencia), programa copias de la base desde Supabase y guarda los archivos de los buckets. Los copilotos, motos y documentos requieren copia directa de la base.
- **Alta y baja de usuarios.** Se hace solo desde la ficha del socio. No edites usuarios a mano en Supabase salvo para el administrador inicial.
- **Rotación de claves.** Si se rota la clave `anon`, actualiza el *secret* `SUPABASE_ANON_KEY` en GitHub y el `config.js` local, y vuelve a desplegar.
- **Actualizaciones.** Cambios en el código: `git push` a `main`. Cambios en la Edge Function: copiar el archivo y volver a desplegar en Supabase. Cambios de base de datos: ejecutar el SQL en el editor.
- **Tipografía.** La fuente de la convocatoria está en `fonts/` (licencia OFL, ver `fonts/README`).
- **Licencia del código:** MIT.

---

## 11. Limitaciones conocidas y recomendaciones

Estos puntos salen de revisar el código y los scripts SQL del proyecto. Se listan por importancia.

1. **Reglas RLS abiertas en socios, asambleas y asistencia.**
   - `supabase_fix_grants_authenticated.sql` permite a **cualquier usuario autenticado** leer y escribir esas tablas, sea cual sea su rol. Un usuario de rol lectura con conocimientos técnicos podría modificarlas llamando directamente a la API.
   - `supabase_schema.sql` y `supabase_fix_rls.sql` además dan permisos al rol `anon` (sin iniciar sesión). **Si esas políticas siguen activas en tu proyecto, cualquiera que tenga la URL y la clave pública podría leer y modificar los socios.** Revisa en Supabase → Authentication → Policies y elimina las políticas `*_anon` si ya no hacen falta.
   - **Recomendación:** reemplazarlas por reglas por rol, como las de `copilotos`, `motos` y `documentos` (lectura para autenticados; escritura solo para `admin` o `admin`/`secretario` según el módulo).
2. **Respaldo incompleto.** Exportar, importar y "Borrar todo" no cubren copilotos, motocicletas, documentos, fotos ni usuarios. Además, las funciones de respaldo y borrado no comprueban el rol en el servidor; solo se oculta el panel a quien no es admin.
3. **Límite de filas de la API.** Supabase devuelve por defecto hasta **1000 filas** por consulta. El Inicio y el Cuadro anual leen toda la tabla de asistencia sin paginar. Con muchos socios y asambleas (por ejemplo 60 socios y más de 16 asambleas) los resultados quedarían incompletos. **Recomendación:** paginar la consulta o subir el límite en la configuración de la API.
4. **Clave temporal aplicada en el navegador.** Ver 5.2.
5. **Inconsistencias de fecha.** Algunas reglas usan la fecha UTC (`toISOString`) y otras la local. Cerca de la medianoche puede cambiar el resultado de "asamblea pasada" o "realizada este año". El Cuadro anual usa fecha local.
6. **Dos cálculos de promedio.** El Inicio y el Cuadro anual calculan la asistencia promedio con fórmulas distintas (ver 6.1 y 6.8), por lo que pueden mostrar cifras diferentes.
7. **README desactualizado.** El `README.md` aún describe la versión inicial con IndexedDB y contraseñas fijas en el código. Esa información ya no aplica; este documento la sustituye.
8. **Dependencia de CDN.** Si falla un CDN, no cargan Supabase ni los PDF. Se podrían alojar las librerías dentro del proyecto.
9. **Sin pruebas automatizadas del navegador.** Las pruebas realizadas fueron revisiones de sintaxis y pruebas con datos simulados en Node.
10. **Sin auditoría.** No se registra quién cambió qué (solo `subido_por` en documentos).

---

## 12. Glosario

| Término | Significado |
|---|---|
| **SPA** | Aplicación de una sola página; la navegación no recarga el sitio |
| **RLS** | *Row Level Security*; reglas de PostgreSQL que limitan qué filas puede leer o escribir cada usuario |
| **anon key** | Clave pública de Supabase, pensada para ir en el navegador |
| **service_role** | Clave de control total de Supabase; solo se usa en el servidor |
| **Edge Function** | Código que se ejecuta en el servidor de Supabase (aquí, la gestión de accesos) |
| **Bucket** | Contenedor de archivos de Supabase Storage |
| **URL firmada** | Enlace temporal para ver o descargar un archivo privado |
| **Email sintético** | Correo `<cedula>@lama.app` que la aplicación genera para usar la cédula como usuario |
| **Asamblea considerada** | Asamblea ya realizada y con asistencia registrada; es la base de los indicadores |
| **Rango / cargo** | Posición del socio; seis son cargos únicos de la directiva |
| **Árbol** | Vista de Socios donde cada socio muestra, tabulados, sus copilotos y motos |
