/** Esquema de la base (D1). Una sola cuenta. El servidor lo crea solo si falta. */
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (th TEXT PRIMARY KEY, created_at INTEGER NOT NULL, seen_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS projects (code TEXT PRIMARY KEY, cliente TEXT NOT NULL, tipo TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, params TEXT NOT NULL DEFAULT '{}', orden INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS plan (month TEXT NOT NULL, project TEXT NOT NULL, task_type TEXT NOT NULL, hours REAL NOT NULL DEFAULT 0, units INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (month, project, task_type))`,
  `CREATE TABLE IF NOT EXISTS lb_tasks (id TEXT PRIMARY KEY, project TEXT NOT NULL, as_code TEXT NOT NULL DEFAULT '', estado TEXT NOT NULL, tipo_servicio TEXT NOT NULL DEFAULT '', anchor TEXT NOT NULL DEFAULT '', url_cliente TEXT NOT NULL DEFAULT '', medio TEXT NOT NULL DEFAULT '', dr REAL, trafico INTEGER, precio REAL, moneda TEXT NOT NULL DEFAULT 'USD', estado_neg TEXT NOT NULL DEFAULT '', mail_eleven TEXT NOT NULL DEFAULT '', contacto_medio TEXT NOT NULL DEFAULT '', deadline TEXT NOT NULL DEFAULT '', notas TEXT NOT NULL DEFAULT '', publicado TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS lb_project ON lb_tasks (project)`,
  `CREATE TABLE IF NOT EXISTS redacciones (id TEXT PRIMARY KEY, project TEXT NOT NULL, tema TEXT NOT NULL, subproyecto TEXT NOT NULL DEFAULT '', idioma TEXT NOT NULL DEFAULT 'Español', pais TEXT NOT NULL DEFAULT 'Argentina', fecha_entrega TEXT NOT NULL DEFAULT '', prioridad TEXT NOT NULL DEFAULT 'Normal', ia INTEGER NOT NULL DEFAULT 0, estado TEXT NOT NULL DEFAULT 'Pendiente', notas TEXT NOT NULL DEFAULT '', entregada TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS hours (id TEXT PRIMARY KEY, date TEXT NOT NULL, project TEXT NOT NULL, task_type TEXT NOT NULL, hours REAL NOT NULL, note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS hours_date ON hours (date)`,
  `CREATE TABLE IF NOT EXISTS as_log (id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, ref TEXT NOT NULL, label TEXT NOT NULL, change TEXT NOT NULL, at INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS notification_log (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, date TEXT NOT NULL, sent_at INTEGER NOT NULL, UNIQUE (kind, date))`,
];

/** Columnas agregadas después (se suman a bases existentes; si ya están, el error se ignora). */
export const MIGRATIONS = [
  `ALTER TABLE lb_tasks ADD COLUMN usuario TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE redacciones ADD COLUMN as_code TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE redacciones ADD COLUMN usuario TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE redacciones ADD COLUMN variante TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE redacciones ADD COLUMN deadline_estado TEXT NOT NULL DEFAULT ''`,
];
