# Autenticación con roles (Supabase Auth)

La app usa **Supabase Auth** para el inicio de sesión. Los usuarios entran con su
**cédula** y una **contraseña**. Internamente, la cédula se convierte en un email
sintético `<cedula>@lama.app` que es lo que valida Supabase.

## Roles

| Rol | Cómo se asigna | Puede |
|-----|----------------|-------|
| **Administrador** | Usuario especial creado a mano (una vez) | Todo el portal, incluida la gestión de accesos de socios |
| **Secretario** | Socio con el check "Es secretario" marcado | Administrar Asambleas y Asistencia; ver el resto |
| **Lectura** | Socio con acceso pero sin el check de secretario | Solo consultar Inicio, Socios, Asistencia y Cuadro anual |

El acceso de cada socio se gestiona **desde su ficha** (pestaña Socios → editar socio →
sección "Acceso al sistema"), no desde Supabase.

---

## Puesta en marcha (una sola vez)

### 1. Crear la tabla de perfiles
Supabase → **SQL Editor → New query** → pega `docs/supabase_auth_perfiles.sql` → **Run**.

### 2. Desplegar la Edge Function
Supabase → **Edge Functions → Create a new function**:
- Nombre exacto: **gestion-usuarios**
- Pega todo `docs/edge-function-gestion-usuarios.ts` y despliega.
- No hay que configurar variables: Supabase inyecta `SUPABASE_URL` y
  `SUPABASE_SERVICE_ROLE_KEY` automáticamente.

### 3. Crear el usuario administrador (bootstrap)
Como aún no hay ningún admin que pueda crear accesos, el primero se crea a mano:
1. Supabase → **Authentication → Users → Add user → Create new user**.
2. En **Email** escribe la cédula del admin seguida de `@lama.app`
   (por ejemplo `1700000000@lama.app`). Marca **Auto Confirm User**.
3. Define su contraseña.
4. En **SQL Editor**, sube su rol a admin (reemplaza la cédula):
   ```sql
   update public.perfiles set rol = 'admin'
   where cedula = '1700000000';
   ```

A partir de aquí, el admin entra con esa cédula y contraseña, y desde la ficha de
cada socio puede dar acceso y asignar rol (secretario o lectura).

---

## Uso diario

- **Dar acceso a un socio:** Socios → editar → marca "Tiene acceso al sistema",
  define una contraseña y, si corresponde, marca "Es secretario". Guardar.
- **Cambiar rol:** edita el socio y marca/desmarca "Es secretario".
- **Cambiar contraseña:** edita el socio con acceso y escribe una nueva contraseña
  (si la dejas vacía, no se cambia).
- **Quitar acceso:** edita el socio y desmarca "Tiene acceso al sistema".

> La cédula es el usuario. Si cambias la cédula de un socio que ya tenía acceso,
> se tratará como un usuario distinto; lo recomendable es no cambiar la cédula una
> vez creado el acceso.

---

## Seguridad
- La clave `service_role` (control total) vive solo dentro de la Edge Function, en
  el servidor de Supabase. Nunca se expone en el navegador.
- La clave `anon` sí es pública (va en el navegador), pero solo permite iniciar
  sesión y leer el propio perfil; no permite administrar usuarios.
- Conviene cerrar las políticas RLS de las tablas de datos para que solo usuarios
  autenticados con permiso escriban (siguiente fase).
