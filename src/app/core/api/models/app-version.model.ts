/**
 * Versión vigente de la app móvil (Flutter). Es un recurso global: no
 * pertenece a ningún centro, así que la comparten todos los tenants.
 */
export interface AppVersionDto {
  id: string;
  /** Versión publicada, con build opcional: `MAJOR.MINOR.PATCH[+BUILD]`. */
  latestVersion: string;
  /** Si es `true`, la app bloquea el acceso hasta que el paciente actualice. */
  mandatoryUpdate: boolean;
  /** ISO-8601 con la fecha del último cambio. */
  updatedAt: string;
}

export interface UpdateAppVersionRequest {
  latestVersion: string;
  mandatoryUpdate: boolean;
}
