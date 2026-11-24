DROP DATABASE IF EXISTS rescate_comida;
CREATE DATABASE rescate_comida CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rescate_comida;

CREATE TABLE usuarios (
  id_usuario            INT            NOT NULL AUTO_INCREMENT,
  nombre                VARCHAR(150)   NOT NULL,
  correo                VARCHAR(120)   NOT NULL,
  contrasena_hash       VARCHAR(255)   NOT NULL,
  telefono              VARCHAR(20)    NOT NULL,
  rol                   ENUM('DONANTE','RECEPTOR','VOLUNTARIO','ADMINISTRADOR') NOT NULL,
  direccion             VARCHAR(255)   NOT NULL,
  latitud               DECIMAL(9,6)   NULL,
  longitud              DECIMAL(9,6)   NULL,
  estado_verificacion   ENUM('NO_VERIFICADO','EN_REVISION','VERIFICADO','RECHAZADO') NOT NULL DEFAULT 'NO_VERIFICADO',
  indice_confiabilidad  DECIMAL(2,1)   NOT NULL DEFAULT 0.0,
  acepta_terminos       TINYINT(1)     NOT NULL DEFAULT 0,
  avisar_nuevos_lotes   TINYINT(1)     NOT NULL DEFAULT 1,
  avisar_caducidades    TINYINT(1)     NOT NULL DEFAULT 1,
  activo                TINYINT(1)     NOT NULL DEFAULT 1,
  fecha_registro        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuarios_correo (correo),
  KEY idx_usuarios_rol (rol),
  CONSTRAINT chk_usuarios_confiabilidad CHECK (indice_confiabilidad BETWEEN 0.0 AND 5.0)
) ENGINE=InnoDB;

CREATE TABLE disponibilidad_receptor (
  id_receptor          INT            NOT NULL,
  recibiendo_lotes     TINYINT(1)     NOT NULL DEFAULT 0,
  capacidad_kg         DECIMAL(8,2)   NOT NULL DEFAULT 0.00,
  horario_inicio       TIME           NULL,
  horario_fin          TIME           NULL,
  radio_cobertura_km   DECIMAL(5,2)   NOT NULL DEFAULT 5.00,
  fecha_actualizacion  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_receptor),
  CONSTRAINT fk_disp_receptor FOREIGN KEY (id_receptor) REFERENCES usuarios (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE solicitudes_verificacion (
  id_solicitud      INT       NOT NULL AUTO_INCREMENT,
  id_usuario        INT       NOT NULL,
  id_administrador  INT       NULL,
  estado            ENUM('BORRADOR','EN_REVISION','APROBADA','RECHAZADA') NOT NULL DEFAULT 'BORRADOR',
  observaciones     TEXT      NULL,
  fecha_envio       DATETIME  NULL,
  fecha_revision    DATETIME  NULL,
  PRIMARY KEY (id_solicitud),
  CONSTRAINT fk_sol_usuario FOREIGN KEY (id_usuario)       REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_sol_admin   FOREIGN KEY (id_administrador) REFERENCES usuarios (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE documentos_verificacion (
  id_documento    INT           NOT NULL AUTO_INCREMENT,
  id_solicitud    INT           NOT NULL,
  tipo_documento  ENUM('IDENTIFICACION_OFICIAL','IDENTIFICACION_FISCAL','PERMISO_SANITARIO','CONSTANCIA_ORGANIZACION') NOT NULL,
  url_archivo     VARCHAR(255)  NULL,
  estado          ENUM('PENDIENTE','CARGADO') NOT NULL DEFAULT 'PENDIENTE',
  fecha_carga     DATETIME      NULL,
  PRIMARY KEY (id_documento),
  CONSTRAINT fk_doc_solicitud FOREIGN KEY (id_solicitud) REFERENCES solicitudes_verificacion (id_solicitud) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE categorias_alimento (
  id_categoria  INT          NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(60)  NOT NULL,
  PRIMARY KEY (id_categoria),
  UNIQUE KEY uq_categoria_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE lotes_alimentos (
  id_lote               INT           NOT NULL AUTO_INCREMENT,
  id_donante            INT           NOT NULL,
  id_categoria          INT           NOT NULL,
  nombre                VARCHAR(100)  NOT NULL,
  descripcion           TEXT          NOT NULL,
  peso_kg               DECIMAL(8,2)  NOT NULL,
  fecha_caducidad       DATE          NOT NULL,
  hora_caducidad        TIME          NULL,
  direccion_recogida    VARCHAR(255)  NOT NULL,
  latitud               DECIMAL(9,6)  NOT NULL,
  longitud              DECIMAL(9,6)  NOT NULL,
  declaracion_buena_fe  TINYINT(1)    NOT NULL DEFAULT 0,
  estado                ENUM('PUBLICADO','EN_RECOLECCION','ENTREGADO','CANCELADO','CADUCADO') NOT NULL DEFAULT 'PUBLICADO',
  fecha_publicacion     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_lote),
  KEY idx_lotes_caducidad (fecha_caducidad),
  KEY idx_lotes_estado (estado),
  CONSTRAINT fk_lote_donante   FOREIGN KEY (id_donante)   REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_lote_categoria FOREIGN KEY (id_categoria) REFERENCES categorias_alimento (id_categoria),
  CONSTRAINT chk_lote_peso CHECK (peso_kg > 0)
) ENGINE=InnoDB;

CREATE TABLE fotos_lote (
  id_foto       INT           NOT NULL AUTO_INCREMENT,
  id_lote       INT           NOT NULL,
  url_foto      VARCHAR(255)  NOT NULL,
  es_principal  TINYINT(1)    NOT NULL DEFAULT 0,
  PRIMARY KEY (id_foto),
  CONSTRAINT fk_foto_lote FOREIGN KEY (id_lote) REFERENCES lotes_alimentos (id_lote) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE emparejamientos (
  id_emparejamiento  INT           NOT NULL AUTO_INCREMENT,
  id_lote            INT           NOT NULL,
  id_receptor        INT           NOT NULL,
  distancia_km       DECIMAL(6,2)  NOT NULL,
  posicion           INT           NOT NULL,
  fecha_generacion   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_emparejamiento),
  CONSTRAINT fk_emp_lote     FOREIGN KEY (id_lote)     REFERENCES lotes_alimentos (id_lote) ON DELETE CASCADE,
  CONSTRAINT fk_emp_receptor FOREIGN KEY (id_receptor) REFERENCES usuarios (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE rutas_recoleccion (
  id_ruta                     INT           NOT NULL AUTO_INCREMENT,
  id_lote                     INT           NOT NULL,
  id_receptor                 INT           NOT NULL,
  id_voluntario               INT           NULL,
  distancia_km                DECIMAL(6,2)  NULL,
  ventana_recoleccion_inicio  TIME          NULL,
  ventana_recoleccion_fin     TIME          NULL,
  estado                      ENUM('DISPONIBLE','EN_RECOLECCION','EN_CAMINO','ENTREGADA','CANCELADA') NOT NULL DEFAULT 'DISPONIBLE',
  fecha_aceptacion            DATETIME      NULL,
  fecha_cierre                DATETIME      NULL,
  PRIMARY KEY (id_ruta),
  UNIQUE KEY uq_ruta_lote (id_lote),
  KEY idx_rutas_estado (estado),
  CONSTRAINT fk_ruta_lote       FOREIGN KEY (id_lote)       REFERENCES lotes_alimentos (id_lote),
  CONSTRAINT fk_ruta_receptor   FOREIGN KEY (id_receptor)   REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_ruta_voluntario FOREIGN KEY (id_voluntario) REFERENCES usuarios (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE checklists_inocuidad (
  id_checklist      INT           NOT NULL AUTO_INCREMENT,
  id_ruta           INT           NOT NULL,
  temperatura_c     DECIMAL(4,1)  NULL,
  aprobado          TINYINT(1)    NOT NULL DEFAULT 0,
  observaciones     TEXT          NULL,
  fecha_validacion  DATETIME      NULL,
  PRIMARY KEY (id_checklist),
  UNIQUE KEY uq_checklist_ruta (id_ruta),
  CONSTRAINT fk_check_ruta FOREIGN KEY (id_ruta) REFERENCES rutas_recoleccion (id_ruta)
) ENGINE=InnoDB;

CREATE TABLE items_checklist (
  id_item       INT           NOT NULL AUTO_INCREMENT,
  id_checklist  INT           NOT NULL,
  criterio      VARCHAR(100)  NOT NULL,
  cumple        TINYINT(1)    NOT NULL DEFAULT 0,
  PRIMARY KEY (id_item),
  CONSTRAINT fk_item_checklist FOREIGN KEY (id_checklist) REFERENCES checklists_inocuidad (id_checklist) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE evidencias_entrega (
  id_evidencia         INT           NOT NULL AUTO_INCREMENT,
  id_ruta              INT           NOT NULL,
  firma_digital        VARCHAR(255)  NULL,
  codigo_confirmacion  VARCHAR(20)   NULL,
  fecha_registro       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_evidencia),
  UNIQUE KEY uq_evidencia_ruta (id_ruta),
  CONSTRAINT fk_evid_ruta FOREIGN KEY (id_ruta) REFERENCES rutas_recoleccion (id_ruta),
  CONSTRAINT chk_evid_firma_o_codigo CHECK (firma_digital IS NOT NULL OR codigo_confirmacion IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE fotos_evidencia (
  id_foto_evidencia  INT           NOT NULL AUTO_INCREMENT,
  id_evidencia       INT           NOT NULL,
  url_foto           VARCHAR(255)  NOT NULL,
  PRIMARY KEY (id_foto_evidencia),
  CONSTRAINT fk_fotoev_evidencia FOREIGN KEY (id_evidencia) REFERENCES evidencias_entrega (id_evidencia) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notificaciones (
  id_notificacion  INT           NOT NULL AUTO_INCREMENT,
  id_usuario       INT           NOT NULL,
  id_lote          INT           NULL,
  tipo             ENUM('NUEVO_LOTE','CADUCIDAD_PROXIMA','CUENTA') NOT NULL,
  mensaje          VARCHAR(255)  NOT NULL,
  leida            TINYINT(1)    NOT NULL DEFAULT 0,
  fecha_envio      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_notificacion),
  CONSTRAINT fk_notif_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_notif_lote    FOREIGN KEY (id_lote)    REFERENCES lotes_alimentos (id_lote)
) ENGINE=InnoDB;

CREATE TABLE historial_actividad (
  id_historial    INT       NOT NULL AUTO_INCREMENT,
  id_usuario      INT       NOT NULL,
  id_lote         INT       NOT NULL,
  id_contraparte  INT       NULL,
  estado          ENUM('EN_RECOLECCION','ENTREGADO','CANCELADO') NOT NULL,
  fecha_evento    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_historial),
  KEY idx_historial_fecha (fecha_evento),
  CONSTRAINT fk_hist_usuario    FOREIGN KEY (id_usuario)     REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_hist_lote       FOREIGN KEY (id_lote)        REFERENCES lotes_alimentos (id_lote),
  CONSTRAINT fk_hist_contraparte FOREIGN KEY (id_contraparte) REFERENCES usuarios (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE calificaciones (
  id_calificacion  INT           NOT NULL AUTO_INCREMENT,
  id_ruta          INT           NOT NULL,
  id_evaluador     INT           NOT NULL,
  id_evaluado      INT           NOT NULL,
  puntuacion       TINYINT       NOT NULL,
  comentario       VARCHAR(255)  NULL,
  fecha            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_calificacion),
  UNIQUE KEY uq_calif_ruta_evaluador_evaluado (id_ruta, id_evaluador, id_evaluado),
  CONSTRAINT fk_calif_ruta      FOREIGN KEY (id_ruta)      REFERENCES rutas_recoleccion (id_ruta),
  CONSTRAINT fk_calif_evaluador FOREIGN KEY (id_evaluador) REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_calif_evaluado  FOREIGN KEY (id_evaluado)  REFERENCES usuarios (id_usuario),
  CONSTRAINT chk_calif_puntuacion CHECK (puntuacion BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE TABLE configuracion_sistema (
  clave        VARCHAR(50)   NOT NULL,
  valor        VARCHAR(100)  NOT NULL,
  descripcion  VARCHAR(255)  NULL,
  PRIMARY KEY (clave)
) ENGINE=InnoDB;

INSERT INTO categorias_alimento (nombre) VALUES
  ('Frutas y verduras'),
  ('Panadería'),
  ('Lácteos'),
  ('Carnes y pescados'),
  ('Abarrotes'),
  ('Comida preparada'),
  ('Bebidas'),
  ('Otros');

INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
  ('umbral_caducidad_horas', '6',   'Horas antes de caducar en que un lote sin reclamar dispara alerta (CU 11)'),
  ('intervalo_alertas_min',  '5',   'Cada cuántos minutos corre la tarea programada de caducidades'),
  ('kg_por_racion',          '0.4', 'Kg de alimento equivalentes a una ración para el KPI de raciones estimadas'),
  ('radio_voluntarios_km',   '10',  'Radio para avisar a voluntarios de rutas y caducidades cercanas'),
  ('horas_lote_nuevo',       '2',   'Horas durante las que un lote se etiqueta como Nuevo');

INSERT INTO usuarios (nombre, correo, contrasena_hash, telefono, rol, direccion,
                      estado_verificacion, acepta_terminos)
VALUES ('Administrador', 'admin@rescate.mx',
        '$2b$10$Di.sDngurZgZTp7O6wZiF.GopSrN9p6EseM47mIAR2JF0.JEPnll2',
        '0000000000', 'ADMINISTRADOR', 'Oficina central', 'VERIFICADO', 1);
