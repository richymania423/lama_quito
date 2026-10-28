# Migración a Supabase (base de datos gratuita en la nube)

La aplicación guarda los datos localmente con **IndexedDB** (archivo `js/db.js`). Toda la lógica de persistencia está aislada en el objeto `DB`, por lo que para pasar a la nube solo hay que reescribir ese archivo. El resto de la aplicación no cambia.

Supabase ofrece una capa gratuita con PostgreSQL, API REST automática y autenticación. Es la opción recomendada cuando **varios secretarios o directivos** necesitan compartir los mismos datos.

---

## 1. Crear el proyecto en Supabase

1. Entra en [supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Crea un nuevo proyecto. Anota la **Project URL** y la clave **anon public** (Settings → API).

> La clave `anon` es pública y puede usarse en el navegador. Aun así, **no la subas al repositorio**: cárgala desde una configuración o variable de entorno.

---

## 2. Crear las tablas (SQL)

En Supabase → **SQL Editor**, ejecuta:

```sql
-- Socios
create table socios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  identificacion text,
  telefono text,
  email text,
  activo boolean default true,
  creado timestamptz default now()
);

-- Asambleas
create table asambleas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora text,
  lugar text,
  mes_correspondencia text,
  orden_dia jsonb default '[]'::jsonb,
  temas text,
  creado timestamptz default now()
);

-- Asistencia (relación socio <-> asamblea)
create table asistencia (
  id uuid primary key default gen_random_uuid(),
  asamblea_id uuid references asambleas(id) on delete cascade,
  socio_id uuid references socios(id) on delete cascade,
  presente boolean default false,
  observacion text,
  unique (asamblea_id, socio_id)
);
```

> **Row Level Security (RLS):** para una primera versión interna puedes dejar las tablas sin RLS o con políticas abiertas. Para producción, activa RLS y define políticas según la autenticación de Supabase.

---

## 3. Incluir el cliente de Supabase

En `index.html`, antes de los scripts de la app, añade:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

---

## 4. Reescribir `js/db.js`

Sustituye el contenido por una implementación con el mismo contrato de métodos (misma firma pública), de modo que `socios.js`, `asambleas.js`, etc. sigan funcionando igual:

```js
const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON = "TU_CLAVE_ANON_PUBLIC";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const DB = (() => {
  const socios = {
    listar: async () => (await sb.from("socios").select("*").order("nombre")).data || [],
    obtener: async (id) => (await sb.from("socios").select("*").eq("id", id).single()).data,
    guardar: async (data) => {
      const row = {
        nombre: data.nombre, identificacion: data.identificacion,
        telefono: data.telefono, email: data.email, activo: data.activo !== false,
      };
      if (data.id) { await sb.from("socios").update(row).eq("id", data.id); return { ...row, id: data.id }; }
      return (await sb.from("socios").insert(row).select().single()).data;
    },
    eliminar: (id) => sb.from("socios").delete().eq("id", id),
  };

  const asambleas = {
    listar: async () => (await sb.from("asambleas").select("*").order("fecha", { ascending: false })).data || [],
    obtener: async (id) => (await sb.from("asambleas").select("*").eq("id", id).single()).data,
    guardar: async (data) => {
      const row = {
        fecha: data.fecha, hora: data.hora, lugar: data.lugar,
        mes_correspondencia: data.mesCorrespondencia,
        orden_dia: data.ordenDia || [], temas: data.temas || "",
      };
      if (data.id) { await sb.from("asambleas").update(row).eq("id", data.id); return { ...data }; }
      return (await sb.from("asambleas").insert(row).select().single()).data;
    },
    eliminar: (id) => sb.from("asambleas").delete().eq("id", id),
  };

  const asistencia = {
    porAsamblea: async (asambleaId) =>
      (await sb.from("asistencia").select("*").eq("asamblea_id", asambleaId)).data || [],
    porSocio: async (socioId) =>
      (await sb.from("asistencia").select("*").eq("socio_id", socioId)).data || [],
    marcar: ({ asambleaId, socioId, presente, observacion }) =>
      sb.from("asistencia").upsert(
        { asamblea_id: asambleaId, socio_id: socioId, presente, observacion: observacion || "" },
        { onConflict: "asamblea_id,socio_id" }
      ),
    eliminar: (id) => sb.from("asistencia").delete().eq("id", id),
    todos: async () => (await sb.from("asistencia").select("*")).data || [],
  };

  // exportar / importar / borrarTodo según necesites
  return { socios, asambleas, asistencia };
})();
window.DB = DB;
```

> Nota: en Supabase los campos usan `snake_case` (p. ej. `mes_correspondencia`, `orden_dia`). Mapea los nombres a los que usa la interfaz (`mesCorrespondencia`, `ordenDia`) dentro de `db.js` para no tocar el resto del código. El ejemplo anterior ya lo hace en los `guardar`; replica el mapeo también al leer si lo necesitas, o crea una vista en SQL con alias.

---

## 5. Proteger la clave

Para no exponer la clave en el repositorio:

- Mantén `SUPABASE_URL` y `SUPABASE_ANON` en un archivo `js/config.local.js` que esté en `.gitignore`, o
- Si usas un bundler, cárgalas desde variables de entorno (`.env`, ya ignorado).

---

## Resumen

| Paso | Acción |
|------|--------|
| 1 | Crear proyecto y copiar URL + clave anon |
| 2 | Ejecutar el SQL de las tablas |
| 3 | Añadir el `<script>` de supabase-js |
| 4 | Reescribir `js/db.js` con el mismo contrato |
| 5 | Proteger la clave fuera del repositorio |

Con eso, la misma interfaz pasa de almacenamiento local a una base compartida en la nube sin cambiar los demás módulos.
