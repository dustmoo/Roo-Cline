import { z } from "zod"

// Schema for mode-specific settings
const ModeSettingsSchema = z.object({
	maxHistoryItems: z.number().min(1, "Must keep at least 1 history item"),
	maxPatterns: z.number().min(1, "Must track at least 1 pattern"),
	maxMistakes: z.number().min(1, "Must track at least 1 mistake"),
})

// Schema for the entire context memory settings file
export const ContextMemorySettingsSchema = z.object({
	enabled: z.boolean(),
	modeSettings: z.record(z.string(), ModeSettingsSchema),
})

export type ContextMemorySettings = z.infer<typeof ContextMemorySettingsSchema>

/**
 * Default settings to use when none are configured
 */
export const DEFAULT_MEMORY_SETTINGS: ContextMemorySettings = {
	enabled: true,
	modeSettings: {
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
	},
}

/**
 * Validates context memory settings against the schema
 * @throws {z.ZodError} if validation fails
 */
export function validateContextMemorySettings(settings: unknown): asserts settings is ContextMemorySettings {
	ContextMemorySettingsSchema.parse(settings)
}
