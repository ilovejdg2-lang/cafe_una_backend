type BodyRecord = Record<string, unknown> | undefined | null;

function pascalKey(camel: string): string {
  return camel[0].toUpperCase() + camel.slice(1);
}

export function pickString(body: BodyRecord, camel: string, pascal?: string): string {
  const p = pascal ?? pascalKey(camel);
  const value = body?.[camel] ?? body?.[p];
  return typeof value === 'string' ? value : '';
}

export function pickOptionalString(
  body: BodyRecord,
  camel: string,
  pascal?: string,
): string | undefined {
  const value = pickString(body, camel, pascal);
  return value || undefined;
}

/** Acepta camelCase del frontend React o PascalCase del backend .NET. */
export function normalizeAuthBody(body: BodyRecord) {
  return {
    identifier: pickString(body, 'identifier', 'Identifier'),
    password: pickString(body, 'password', 'Password'),
    nombre: pickString(body, 'nombre', 'Nombre'),
    correo: pickString(body, 'correo', 'Correo'),
    token: pickString(body, 'token', 'Token'),
    nuevaPassword: pickString(body, 'nuevaPassword', 'NuevaPassword'),
  };
}
