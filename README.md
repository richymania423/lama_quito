# 📋 Secretario LAMA

Aplicación web para las funciones de **secretario de un grupo**: registro de socios, control de asistencia a asambleas, orden del día, temas tratados y generación de documentos PDF.

No requiere servidor ni instalación: es una aplicación estática (HTML + CSS + JavaScript) que guarda la información en el navegador mediante **IndexedDB**. Se puede publicar gratis en **GitHub Pages**.

---

## ✨ Funcionalidades

- **Socios** — Registro del listado de socios (nombre, identificación, teléfono, correo, estado activo/inactivo) con búsqueda.
- **Asambleas** — Registro de asambleas realizadas con **fecha, hora, lugar y mes de correspondencia**.
- **Orden del día** — Lista de puntos a tratar en cada asamblea.
- **Temas tratados** — Resumen de los temas principales de la asamblea en curso.
- **Asistencia** — Registro de asistencia por socio basado en el listado, con observaciones y marcado masivo.
- **Documento PDF** — Acta de la asamblea con listado de asistentes, ausentes, orden del día, resumen de temas y espacio para firmas.
- **Cuadro anual** — Tabla de asistencias de todos los socios a las asambleas del año, con porcentaje individual y exportación a PDF.
- **Respaldo** — Exportar/importar toda la información en un archivo JSON y opción de borrar todo.
- **Roles de acceso** — Ingreso por rol (Administrador, Secretario, Lectura) con permisos diferenciados. Ver sección [Roles y acceso](#-roles-y-acceso).

---

## 🚀 Cómo usarlo en local

Al ser una app estática, basta con abrir `index.html` en el navegador. Para evitar restricciones de algunos navegadores, es preferible servirla con un servidor local:

```bash
# Opción 1: con Python (viene preinstalado en muchos equipos)
python -m http.server 8080

# Opción 2: con Node
npx serve .
```

Luego abre `http://localhost:8080`.

> La información se guarda en el navegador del equipo donde la uses. Haz respaldos periódicos desde **Inicio → Exportar respaldo**.

---

## 🌐 Publicar gratis en GitHub Pages

1. Crea un repositorio en GitHub y sube el contenido de esta carpeta:

   ```bash
   git init
   git add .
   git commit -m "Secretario LAMA - versión inicial"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/secretario-lama.git
   git push -u origin main
   ```

2. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. El workflow incluido en `.github/workflows/deploy.yml` publica el sitio automáticamente en cada push a `main`.

3. Tu portal quedará disponible en `https://TU_USUARIO.github.io/secretario-lama/`.

---

## 🗄️ Opciones de base de datos gratuitas

La app funciona por defecto con **IndexedDB** (almacenamiento local del navegador), ideal para un solo secretario y cero configuración. Si necesitas que **varias personas compartan los mismos datos en la nube**, estas son las opciones gratuitas recomendadas:

| Servicio | Tipo | Capa gratuita | Notas |
|----------|------|---------------|-------|
| **Supabase** ⭐ | PostgreSQL + API REST + Auth | 500 MB, hasta 2 proyectos | La opción más completa. API lista para usar desde el navegador. Ver `docs/MIGRACION_SUPABASE.md`. |
| **Firebase (Firestore)** | NoSQL en la nube | Plan Spark gratuito | Sincronización en tiempo real, fácil para apps web. |
| **Turso (libSQL)** | SQLite en la nube | 9 GB, 500 bases | SQLite distribuido, muy ligero. |
| **IndexedDB** (actual) | Navegador (local) | Ilimitado local | Sin servidor ni credenciales. Por defecto en este proyecto. |

> ⚠️ Nunca subas claves/credenciales al repositorio. Usa variables de entorno (`.env`, ya ignorado en `.gitignore`).

La guía paso a paso para migrar a Supabase está en [`docs/MIGRACION_SUPABASE.md`](docs/MIGRACION_SUPABASE.md).

---

## 🔐 Roles y acceso

Al abrir la app aparece una pantalla de ingreso donde se elige el rol. La sesión queda guardada en el navegador hasta que se pulse **Salir**.

| Rol | Puede ver | Puede administrar (crear/editar/eliminar) |
|-----|-----------|-------------------------------------------|
| **Administrador** | Todos los módulos | Todo el portal: socios, asambleas, asistencia, cuadro anual y respaldos |
| **Secretario** | Todos los módulos | Asambleas y Asistencia (el resto solo lectura) |
| **Lectura** | Inicio, Socios, Asistencia y Cuadro anual | Nada (solo consulta) |

Contraseñas por defecto (se configuran en `js/auth.js`, objeto `CREDENCIALES`):

- Administrador: `admin123`
- Secretario: `secre123`
- Lectura: sin contraseña

> ⚠️ **Alcance del control de acceso.** Al ser una aplicación estática sin servidor, este control de roles organiza la interfaz y evita acciones por error, pero **no es una barrera de seguridad fuerte**: alguien con conocimientos técnicos podría sortearlo desde el navegador y los datos siguen siendo locales. Para seguridad real (usuarios, contraseñas protegidas y permisos aplicados en el servidor) se debe mover la autenticación a un backend como **Supabase Auth**. Cambia las contraseñas por defecto antes de usar la app con datos reales.

---

## 📁 Estructura del proyecto

```
SECRETARIO_LAMA/
├── index.html              # Interfaz principal (SPA de una sola página)
├── css/
│   └── styles.css          # Estilos
├── js/
│   ├── auth.js             # Roles y control de acceso (cliente)
│   ├── db.js               # Capa de datos (IndexedDB) — punto único de migración
│   ├── socios.js           # Módulo de socios
│   ├── asambleas.js        # Módulo de asambleas
│   ├── asistencia.js       # Asamblea en curso: orden del día, temas, asistencia
│   ├── cuadro.js           # Cuadro de asistencias anual
│   ├── pdf.js              # Generación de PDF (jsPDF + autotable)
│   └── app.js              # Navegación, modal, toast, respaldo y arranque
├── docs/
│   └── MIGRACION_SUPABASE.md
├── .github/workflows/
│   └── deploy.yml          # Despliegue automático a GitHub Pages
├── .gitignore
├── LICENSE
└── README.md
```

---

## 🧰 Tecnologías

- HTML5, CSS3 y JavaScript (sin frameworks).
- [jsPDF](https://github.com/parallax/jsPDF) + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) para los PDF (cargados vía CDN).
- IndexedDB para la persistencia local.

---

## 📄 Licencia

Distribuido bajo licencia MIT. Ver [`LICENSE`](LICENSE).
