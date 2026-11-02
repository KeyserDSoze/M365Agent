/** Public configuration contract used by init, validation and CI/CD. */
export type Audience =
  | { mode: 'private'; emails: string[]; groupId: null; groupType: null }
  | { mode: 'users'; emails: string[]; groupId: null; groupType: null }
  | { mode: 'group'; emails: []; groupId: string; groupType: 'security' | 'm365' }
  | { mode: 'organization'; emails: []; groupId: null; groupType: null };

export interface AgentConfig {
  name: string;
  displayName: string;
  description: string;
  tenantId: string | null;
  audience: Audience;
  publishToCatalog: boolean;
}

export const GUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const SLUG_PATTERN = /^[a-z][a-z0-9-]{2,47}$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertConfig(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Convert untrusted JSON to a discriminated, validated config. */
export function parseAgentConfig(raw: unknown): AgentConfig {
  assertConfig(isRecord(raw), 'agent.config.json deve essere un oggetto');
  const { name, displayName, description, tenantId, publishToCatalog, audience } = raw;
  assertConfig(typeof name === 'string' && SLUG_PATTERN.test(name) && !name.endsWith('-'), 'name deve essere slug valido (3-48 caratteri)');
  assertConfig(typeof displayName === 'string' && displayName.trim().length >= 1 && displayName.length <= 30, 'displayName deve essere 1-30 caratteri');
  assertConfig(typeof description === 'string' && description.length >= 1, 'description obbligatoria');
  assertConfig(tenantId === null || (typeof tenantId === 'string' && GUID_PATTERN.test(tenantId)), 'tenantId deve essere un GUID o null');
  assertConfig(typeof publishToCatalog === 'boolean', 'publishToCatalog deve essere boolean');
  assertConfig(isRecord(audience), 'audience non valida');
  const { mode, emails, groupId, groupType } = audience;
  assertConfig(Array.isArray(emails) && emails.every((v: unknown): v is string => typeof v === 'string' && EMAIL_PATTERN.test(v)), 'audience.emails deve contenere indirizzi email validi');
  assertConfig(new Set(emails.map((v: string) => v.toLowerCase())).size === emails.length, 'Email duplicate');
  let parsedAudience: Audience;
  switch (mode) {
    case 'private':
      assertConfig(emails.length <= 1 && groupId === null && groupType === null, 'private ammette al massimo una email, senza gruppo');
      parsedAudience = { mode, emails, groupId: null, groupType: null };
      break;
    case 'users':
      assertConfig(emails.length >= 1 && groupId === null && groupType === null, 'users richiede almeno una email, senza gruppo');
      parsedAudience = { mode, emails, groupId: null, groupType: null };
      break;
    case 'group':
      assertConfig(emails.length === 0 && typeof groupId === 'string' && GUID_PATTERN.test(groupId) && (groupType === 'security' || groupType === 'm365'), 'group richiede groupId GUID e groupType security|m365, senza emails');
      parsedAudience = { mode, emails: [], groupId, groupType };
      break;
    case 'organization':
      assertConfig(emails.length === 0 && groupId === null && groupType === null, 'organization non ammette emails o gruppi');
      parsedAudience = { mode, emails: [], groupId: null, groupType: null };
      break;
    default:
      throw new Error('audience.mode deve essere private, users, group o organization');
  }
  assertConfig(!publishToCatalog || parsedAudience.mode === 'group' || parsedAudience.mode === 'organization', 'publishToCatalog ammesso solo per group/organization');
  return { name, displayName, description, tenantId, publishToCatalog, audience: parsedAudience };
}

export function scopeForAudience(audience: Audience): 'personal' | 'shared' {
  return audience.mode === 'private' && audience.emails.length === 0 ? 'personal' : 'shared';
}
