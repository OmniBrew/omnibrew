import { defineGame } from '@omnibrew/engine/schemas'
import { meChecks } from './checks'
import { me5eDefinition } from './definition'

/** Mass Effect 5e with its content checks (Node). The browser uses `me5eDefinition` (definition.ts). */
export const me5e = defineGame({ ...me5eDefinition, checks: meChecks })
