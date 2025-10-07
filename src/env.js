export class MissingEnvVarError extends Error {
  constructor(name, example) {
    const extra = example ? ` (เช่น: ${example})` : "";
    super(`Missing required environment variable '${name}'${extra}.`);
    this.name = "MissingEnvVarError";
    this.envName = name;
    this.example = example;
  }
}

export function getEnvOrThrow(name, { parser = value => value, example } = {}) {
  const raw = process.env[name];
  if (!raw || !String(raw).trim()) {
    throw new MissingEnvVarError(name, example);
  }

  try {
    return parser(raw);
  } catch (error) {
    throw new Error(
      `Invalid value for environment variable '${name}': ${error.message}`
    );
  }
}
