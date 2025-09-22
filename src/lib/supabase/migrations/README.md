# Supabase Migrations for Candidates Portal Chat System

Este directorio contiene las migraciones SQL necesarias para implementar el sistema de chat con magic links en Supabase.

## 📋 Orden de Ejecución

Ejecuta las migraciones en el siguiente orden:

### 1. `001_create_chat_tables.sql`
**Descripción**: Crea las tablas principales y estructura base
- ✅ Tablas: `chat_conversations`, `chat_messages`
- ✅ Tipos enum: `conversation_status`, `opportunity_type`, etc.
- ✅ Índices para performance
- ✅ Triggers para `updated_at` automático
- ✅ RLS (Row Level Security) básico
- ✅ Función para actualizar `last_message_at`

### 2. `002_create_realtime_functions.sql`
**Descripción**: Funciones para la lógica de negocio y real-time
- ✅ `get_conversation_with_candidate()` - Para APIs admin
- ✅ `get_conversation_by_token()` - Para magic link access
- ✅ `get_conversation_messages()` - Obtener mensajes
- ✅ `mark_messages_as_read()` - Marcar como leído
- ✅ `get_unread_count()` - Contar no leídos
- ✅ `is_talent_token_valid()` - Validar tokens
- ✅ `extend_token_expiry()` - Renovar tokens

### 3. `003_setup_realtime_policies.sql`
**Descripción**: Políticas avanzadas y vistas para dashboard
- ✅ Políticas adicionales para service role
- ✅ Vista `admin_conversation_summary`
- ✅ Función `insert_chat_message()` con validación
- ✅ Índices adicionales para performance

### 4. `005_disable_rls_for_development.sql` ⚠️
**Descripción**: Deshabilita RLS para desarrollo (SOLO DESARROLLO)
- ✅ Deshabilita Row Level Security en todas las tablas de chat
- ✅ Otorga permisos completos a todos los roles
- ✅ Acceso sin restricciones para desarrollo rápido
- ⚠️ **NO usar en producción**

### 5. `006_secure_magic_links.sql` 🔒
**Descripción**: Sistema de seguridad avanzado para magic links
- ✅ **Rate limiting** por IP (5/hora, 10/día)
- ✅ **Bot detection** automático
- ✅ **Access logging** completo
- ✅ **Conversation locking** por actividad sospechosa
- ✅ **Browser fingerprinting** para validación
- ✅ **Admin security dashboard** con estadísticas
- ✅ **IP tracking** y análisis de patrones

## 🚀 Cómo Ejecutar

### Opción 1: Supabase Dashboard
1. Ve a **Database > SQL Editor**
2. Copia y pega cada migración **en orden**:
   - `001_create_chat_tables.sql`
   - `002_create_realtime_functions.sql`  
   - `003_setup_realtime_policies.sql`
   - `005_disable_rls_for_development.sql` ⚠️ **SOLO para desarrollo**
   - `006_secure_magic_links.sql` 🔒 **Para producción** (seguridad avanzada)
   - `000_enable_realtime.sql` (al final)
3. Ejecuta una por una

### Opción 2: Supabase CLI
```bash
# Si tienes supabase CLI instalado
supabase db reset --linked
supabase db push
```

### Opción 3: Manual con psql
```bash
psql "postgresql://user:pass@host:port/dbname" -f 001_create_chat_tables.sql
psql "postgresql://user:pass@host:port/dbname" -f 002_create_realtime_functions.sql
psql "postgresql://user:pass@host:port/dbname" -f 003_setup_realtime_policies.sql
```

## 📊 Estructura de Datos

### `chat_conversations`
```sql
id                 UUID PRIMARY KEY
candidate_id       UUID → candidates(id)
admin_user_id      UUID → auth.users(id) o admin users table
status            'active' | 'closed' | 'archived'
talent_token      UUID UNIQUE (para magic links)
token_expires_at  TIMESTAMPTZ (7 días por defecto)
opportunity_type  'direct_hire' | 'project' | 'consultation' | 'collaboration'
urgency          'immediate' | 'flexible' | 'future'
engagement_type  'full_time' | 'part_time' | 'contract' | 'freelance'
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
last_message_at  TIMESTAMPTZ
```

### `chat_messages`
```sql
id               UUID PRIMARY KEY
conversation_id  UUID → chat_conversations(id)
sender_type     'admin' | 'candidate'
sender_id       UUID (admin_user_id o candidate_id)
content         TEXT
message_type    'text' | 'system' | 'file'
read_at         TIMESTAMPTZ (para read receipts)
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

## 🔐 Seguridad (RLS)

### Políticas Implementadas:
- ✅ **Admins** pueden ver/editar sus conversaciones
- ✅ **Service Role** tiene acceso completo (para APIs)
- ✅ **Magic Link** access validado por token
- ✅ **Candidates** pueden insertar mensajes con token válido
- ✅ **Anon users** pueden acceder con talent token

### Funciones de Seguridad:
- ✅ Validación de tokens expirados
- ✅ Verificación de ownership de conversaciones
- ✅ Inserción segura de mensajes
- ✅ Acceso controlado por tipo de usuario

## 🔄 Real-time Setup

**Después de ejecutar las migraciones**, habilita real-time en Supabase Dashboard:

1. Ve a **Database > Replication**
2. Habilita las tablas:
   - ✅ `chat_conversations`
   - ✅ `chat_messages`

O ejecuta en SQL Editor:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
```

## 📈 Performance

### Índices Creados:
- ✅ `chat_conversations`: candidate_id, admin_user_id, talent_token, status, created_at
- ✅ `chat_messages`: conversation_id, sender info, created_at, read_at
- ✅ Índices compuestos para queries complejas

### Optimizaciones:
- ✅ Triggers automáticos para timestamps
- ✅ Funciones optimizadas con `SECURITY DEFINER`
- ✅ Vista materializada para dashboard admin
- ✅ Queries indexadas para real-time

## 🧪 Datos de Prueba

Para insertar datos de prueba después de las migraciones:

```sql
-- Insertar conversación de prueba
INSERT INTO chat_conversations (
    candidate_id, 
    admin_user_id, 
    opportunity_type,
    urgency,
    engagement_type
) VALUES (
    'candidate-uuid-here',
    'admin-uuid-here',
    'direct_hire',
    'flexible',
    'full_time'
);

-- Insertar mensaje de prueba
INSERT INTO chat_messages (
    conversation_id,
    sender_type,
    sender_id,
    content
) VALUES (
    'conversation-uuid-here',
    'admin',
    'admin-uuid-here',
    'Hello! I saw your profile and I think you might be a great fit for this opportunity.'
);
```

## ❗ Notas Importantes

1. **Prerequisitos**: Asegúrate de que la tabla `candidates` existe con columnas `city` y `country`
2. **Auth**: Las políticas asumen que usas Supabase Auth o tienes una tabla de admin users
3. **Service Role**: Las APIs usan service role para bypass RLS
4. **Magic Links**: Los tokens expiran en 7 días por defecto
5. **Real-time**: Debe habilitarse manualmente en Dashboard
6. **Location Field**: Se construye automáticamente combinando `city` y `country`
7. **🚧 Desarrollo**: RLS deshabilitado y emails solo se logean (no se envían)

## 🔧 Troubleshooting

### Error: "relation candidates does not exist"
```sql
-- Verifica que existe la tabla candidates
SELECT * FROM information_schema.tables WHERE table_name = 'candidates';
```

### Error: "column cand.location does not exist"
Este error indica que la tabla `candidates` no tiene una columna `location`. Las migraciones han sido corregidas para usar `city` y `country` por separado y construir `location` dinámicamente:
```sql
-- Las funciones ahora usan:
CASE 
    WHEN cand.city IS NOT NULL AND cand.country IS NOT NULL THEN cand.city || ', ' || cand.country
    WHEN cand.city IS NOT NULL THEN cand.city
    WHEN cand.country IS NOT NULL THEN cand.country
    ELSE NULL
END AS candidate_location
```

### Error: "permission denied for function"
```sql
-- Verifica permisos de las funciones
\df+ get_conversation_by_token
```

### Real-time no funciona
1. Verifica que las tablas estén en replication
2. Checa los filtros en el cliente
3. Confirma que RLS permite el acceso

### Error: "The domain is not verified" (Resend)
En desarrollo, los emails se logean en consola en lugar de enviarse:
```bash
📧 [DEVELOPMENT] Magic Link Email (not sent):
{
  to: 'candidate@example.com',
  magicLink: 'http://localhost:3000/talent/chat/token-uuid',
  ...
}
```

Para probar magic links en desarrollo:
1. Busca el magic link en los logs de consola
2. O usa el componente `DevMagicLinkDisplay` que aparece en la UI
3. Copia el link y ábrelo en nueva pestaña

---

## 🚧 **Modo Desarrollo**

### **Características del Modo Desarrollo:**
- ✅ **RLS deshabilitado** - Sin restricciones de seguridad
- ✅ **Emails no se envían** - Solo se logean en consola
- ✅ **Magic links visibles** - Componente dev muestra links en UI
- ✅ **Acceso completo** - Todas las operaciones permitidas

### **Variables de Entorno para Desarrollo:**
```bash
# .env.local
NODE_ENV=development  # Activa modo desarrollo
# RESEND_API_KEY=    # Opcional en desarrollo - si no está, solo logea emails
```

---

## 🔒 **Sistema de Seguridad Magic Links**

### **Medidas de Protección Implementadas:**

#### **1. Rate Limiting**
- ✅ **5 intentos por hora** por IP
- ✅ **10 intentos por día** por IP
- ✅ **Bloqueo automático** por exceso de intentos

#### **2. Bot Detection**
- ✅ **User Agent analysis** (detecta crawlers, bots, scripts)
- ✅ **Request timing** validation
- ✅ **Referer header** checks
- ✅ **Browser fingerprinting** para validar usuarios reales

#### **3. Access Monitoring**
- ✅ **Logging completo** de todos los intentos
- ✅ **IP tracking** y geolocalización
- ✅ **Suspicious activity** detection
- ✅ **Admin dashboard** para monitoreo

#### **4. Conversation Protection**
- ✅ **Auto-locking** por actividad sospechosa
- ✅ **Token expiration** (7 días por defecto)
- ✅ **Access counting** y tracking
- ✅ **Manual unlock** por admins

### **APIs de Seguridad:**
```typescript
// Validar magic link con seguridad
POST /api/chat/validate-magic-link
{
  "token": "uuid-token",
  "fingerprint": { /* browser data */ }
}

// Dashboard de seguridad admin
GET /api/admin/security-dashboard?adminUserId=uuid

// Desbloquear conversación
POST /api/admin/unlock-conversation
{
  "conversationId": "uuid",
  "reason": "Manual unlock by admin"
}
```

### **Browser Fingerprinting:**
```typescript
// Hook para generar fingerprint
const { fingerprint } = useBrowserFingerprint()

// Incluye:
- User Agent
- Screen resolution
- Color depth
- Timezone
- Language
- Canvas fingerprint
- WebGL fingerprint
- Available fonts
```

### **Security Dashboard:**
- 📊 **Estadísticas** de acceso por conversación
- 🚨 **Alertas** de actividad sospechosa
- 🔍 **Logs detallados** de intentos
- 📈 **Gráficos** de actividad por día
- 🔒 **Gestión** de conversaciones bloqueadas

---

**¡Sistema completo con seguridad empresarial contra bots y ataques!** 🛡️
