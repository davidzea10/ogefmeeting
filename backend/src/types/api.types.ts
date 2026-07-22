/**
 * Types locaux de l'API (couche HTTP).
 * Les types métier partagés vivent dans @ogefmeeting/shared.
 */

export type ControllerSuccess<T> = {
  success: true;
  data: T;
};

export type ControllerFailure = {
  success: false;
  error: {
    message: string;
    details?: unknown;
  };
};

export type ControllerResult<T> = ControllerSuccess<T> | ControllerFailure;
