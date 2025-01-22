import { Mode } from "./modes"

export interface ContextSettings {
	maxHistoryItems: number
	maxPatterns: number
	maxMistakes: number
}

/**
 * Default context memory settings per mode
 */
export const DEFAULT_CONTEXT_SETTINGS: Record<Mode, ContextSettings> = {
	code: {
		maxHistoryItems: 50,
		maxPatterns: 20,
		maxMistakes: 10,
	},
	architect: {
		maxHistoryItems: 30,
		maxPatterns: 15,
		maxMistakes: 5,
	},
	ask: {
		maxHistoryItems: 20,
		maxPatterns: 10,
		maxMistakes: 3,
	},
}
