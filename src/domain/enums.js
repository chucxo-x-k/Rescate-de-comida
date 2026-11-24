// Enumeraciones del diagrama de clases, con los valores del diccionario de datos.

export const RolUsuario = Object.freeze({
  DONANTE: 'DONANTE',
  RECEPTOR: 'RECEPTOR',
  VOLUNTARIO: 'VOLUNTARIO',
  ADMINISTRADOR: 'ADMINISTRADOR',
});

/** Roles que se pueden elegir al registrarse (el administrador se crea por script). */
export const ROLES_REGISTRABLES = Object.freeze([RolUsuario.DONANTE, RolUsuario.RECEPTOR, RolUsuario.VOLUNTARIO]);

/** Roles que requieren verificación de identidad u organización (RF Gestión de Usuarios 2). */
export const ROLES_CON_VERIFICACION = Object.freeze([RolUsuario.DONANTE, RolUsuario.RECEPTOR]);

export const EstadoVerificacion = Object.freeze({
  NO_VERIFICADO: 'NO_VERIFICADO',
  EN_REVISION: 'EN_REVISION',
  VERIFICADO: 'VERIFICADO',
  RECHAZADO: 'RECHAZADO',
});

export const EstadoSolicitud = Object.freeze({
  BORRADOR: 'BORRADOR',
  EN_REVISION: 'EN_REVISION',
  APROBADA: 'APROBADA',
  RECHAZADA: 'RECHAZADA',
});

export const EstadoDocumento = Object.freeze({
  PENDIENTE: 'PENDIENTE',
  CARGADO: 'CARGADO',
});

export const TipoDocumento = Object.freeze({
  IDENTIFICACION_OFICIAL: 'IDENTIFICACION_OFICIAL',
  IDENTIFICACION_FISCAL: 'IDENTIFICACION_FISCAL',
  PERMISO_SANITARIO: 'PERMISO_SANITARIO',
  CONSTANCIA_ORGANIZACION: 'CONSTANCIA_ORGANIZACION',
});

export const EstadoLote = Object.freeze({
  PUBLICADO: 'PUBLICADO',
  EN_RECOLECCION: 'EN_RECOLECCION',
  ENTREGADO: 'ENTREGADO',
  CANCELADO: 'CANCELADO',
  CADUCADO: 'CADUCADO',
});

export const EstadoRuta = Object.freeze({
  DISPONIBLE: 'DISPONIBLE',
  EN_RECOLECCION: 'EN_RECOLECCION',
  EN_CAMINO: 'EN_CAMINO',
  ENTREGADA: 'ENTREGADA',
  CANCELADA: 'CANCELADA',
});

export const EstadoHistorial = Object.freeze({
  EN_RECOLECCION: 'EN_RECOLECCION',
  ENTREGADO: 'ENTREGADO',
  CANCELADO: 'CANCELADO',
});

export const TipoNotificacion = Object.freeze({
  NUEVO_LOTE: 'NUEVO_LOTE',
  CADUCIDAD_PROXIMA: 'CADUCIDAD_PROXIMA',
  CUENTA: 'CUENTA',
});

/** Puntos críticos del checklist de inocuidad (wireframe "Ruta Activa"). */
export const CRITERIOS_INOCUIDAD = Object.freeze([
  'Cadena de frío mantenida',
  'Empaque íntegro y limpio',
  'Sin signos de descomposición',
  'Fecha de caducidad vigente',
]);

export const esValorDe = (enumeracion, valor) => Object.values(enumeracion).includes(valor);
