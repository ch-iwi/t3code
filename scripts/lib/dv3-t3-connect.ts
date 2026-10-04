// DV³ Code ships without T3 Connect until we run our own relay. Builds embed
// the Connect values, so a root `.env` copied from `.env.example` would point
// DV³ Code at T3's hosted Clerk and relay. The desktop build fails instead.
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { resolvePublicConfig } from "./public-config.ts";

export class T3ConnectConfiguredError extends Schema.TaggedError<T3ConnectConfiguredError>()(
  "T3ConnectConfiguredError",
  {
    names: Schema.Array(Schema.String),
  },
) {
  override get message(): string {
    return `DV³ Code ships without T3 Connect. Remove ${this.names.join(", ")} from .env, .env.local, and the build environment.`;
  }
}

/** Canonical names of the T3 Connect values set in `env`, including through their aliases. */
export function configuredT3ConnectNames(env: Readonly<Record<string, string | undefined>>) {
  const config = resolvePublicConfig(env);
  return Object.entries({
    T3CODE_CLERK_PUBLISHABLE_KEY: config.clerkPublishableKey,
    T3CODE_CLERK_JWT_TEMPLATE: config.clerkJwtTemplate,
    T3CODE_CLERK_CLI_OAUTH_CLIENT_ID: config.clerkCliOAuthClientId,
    T3CODE_RELAY_URL: config.relayUrl,
  })
    .filter(([, value]) => value !== undefined)
    .map(([name]) => name);
}

export const assertT3ConnectDisabled = (env: Readonly<Record<string, string | undefined>>) => {
  const names = configuredT3ConnectNames(env);
  return names.length > 0 ? Effect.fail(new T3ConnectConfiguredError({ names })) : Effect.void;
};
