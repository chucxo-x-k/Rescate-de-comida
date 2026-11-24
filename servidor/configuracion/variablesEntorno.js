import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const numero = (valor, porDefecto) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : porDefecto;
};

export const env = Object.freeze({
  puerto: numero(process.env.PORT, 3000),
  entorno: process.env.NODE_ENV ?? 'development',
  db: Object.freeze({
    host: process.env.DB_HOST ?? 'localhost',
    port: numero(process.env.DB_PORT, 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'rescate_comida',
  }),
  jwtSecreto: process.env.JWT_SECRET ?? 'cambia-este-secreto-en-produccion',
  jwtExpiraHoras: numero(process.env.JWT_EXPIRA_HORAS, 12),
  almacenamiento: Object.freeze({
    driver: (process.env.STORAGE_DRIVER ?? 'local').toLowerCase(),
    directorioLocal: process.env.STORAGE_DIR ?? 'uploads',
    s3Bucket: process.env.S3_BUCKET ?? '',
    s3Region: process.env.S3_REGION ?? 'us-east-1',
    s3UrlPublica: process.env.S3_URL_PUBLICA ?? '',
  }),
  tareasProgramadas: (process.env.TAREAS_PROGRAMADAS ?? 'true') !== 'false',
});
