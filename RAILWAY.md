# Desplegar Café UNA Backend en Railway

Repositorio: [github.com/ilovejdg2-lang/cafe_una_backend](https://github.com/ilovejdg2-lang/cafe_una_backend)

## 1. Crear el proyecto en Railway

1. Entra a [Railway Dashboard](https://railway.com/dashboard).
2. **New Project** → **Deploy from GitHub repo**.
3. Conecta GitHub si aún no lo hiciste y elige **`ilovejdg2-lang/cafe_una_backend`**.
4. Railway detectará Node/Nest y usará `railway.toml` (build + start + health check).

## 2. Variables de entorno (Variables)

En el servicio → **Variables**, agrega estas (copia valores reales desde tu `.env` local):

| Variable | Ejemplo / nota |
|----------|----------------|
| `SUPABASE_HOST` | `aws-1-us-east-1.pooler.supabase.com` |
| `SUPABASE_PORT` | `5432` |
| `SUPABASE_DB` | `postgres` |
| `SUPABASE_USER` | `postgres.mtrbjaaujtvgpvsiwfdm` |
| `SUPABASE_PASSWORD` | contraseña de Supabase |
| `JWT_SECRET` | mismo secret que usa el frontend/.NET |
| `JWT_ISSUER` | `CafeUNA` |
| `JWT_AUDUENCE` | `cafe-una-api` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | correo Gmail |
| `SMTP_PASS` | app password de Gmail (sin comillas extra) |
| `SMTP_FROM` | mismo correo |
| `SMTP_FROM_NAME` | `Cafe UNA` |
| `CEDULA_PROVIDER` | `GoMeta` |
| `CEDULA_GOMETA_URL` | `https://apis.gometa.org/cedulas` |

**No configures `PORT`:** Railway la asigna automáticamente.

## 3. Dominio público

1. En el servicio → **Settings** → **Networking** → **Generate Domain**.
2. Obtendrás una URL como: `https://cafe-una-backend-production.up.railway.app`
3. La API queda en: **`https://TU-DOMINIO.up.railway.app/api`**
4. Prueba: `https://TU-DOMINIO.up.railway.app/api/health` → debe responder `{"status":"ok","database":"supabase",...}`

## 4. Conectar el frontend

En `Progra4-proyecto/proyecto-Cafe-UNA/.env` (o variables de Netlify):

```env
BACKEND_URL=https://TU-DOMINIO.up.railway.app/api
```

Vuelve a desplegar o reinicia el frontend (`npm run dev`).

## 5. Despliegues automáticos

Cada `git push` a `main` en GitHub vuelve a desplegar Railway si el repo está conectado.

## Solución de problemas

- **Build falla:** revisa logs; el build usa `npm ci --include=dev && npm run build`.
- **App cae al iniciar:** falta alguna variable `SUPABASE_*` o `JWT_SECRET`.
- **Login OK local pero no en Railway:** confirma mismas credenciales Supabase y `JWT_SECRET` igual al del frontend.
- **Correos no salen:** revisa `SMTP_*` en Variables de Railway.
