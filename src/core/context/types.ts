import * as vscode from "vscode"

/**
 * Core types for the context memory system that integrates with VSCode's state management
 */

/**
 * Represents the complete context memory state
 */
export interface ContextMemory {
	// Current task context
	task: TaskContext

	// Technical context about the project/codebase
	technical: TechnicalContext

	// User-specific context
	user: UserContext
}

/**
 * Represents the current task's context
 */
export interface TaskContext {
	id: string
	scope: string
	stage: string
	progress: {
		completed: string[]
		pending: string[]
	}
	startTime: number
	lastUpdateTime: number
}

/**
 * Represents technical context about the project
 */
export interface TechnicalContext {
	framework?: string
	language?: string
	patterns: string[]
	projectStructure: {
		root: string
		mainFiles: string[]
		dependencies: string[]
	}
	lastAnalyzedFiles: string[]
}

/**
 * Represents user-specific context
 */
export interface UserContext {
	preferences: Record<string, unknown>
	history: {
		recentCommands: Array<{
			command: string
			timestamp: number
		}>
		commonPatterns: Array<{
			pattern: string
			occurrences: number
		}>
		mistakes: Array<{
			type: string
			description: string
			timestamp: number
		}>
	}
}

/**
 * Configuration options for context management
 * Following VSCode extension patterns for state management
 */
export interface ContextConfig {
	// VSCode extension context for state management
	context: vscode.ExtensionContext
	// Maximum items to keep in history lists
	maxHistoryItems?: number
	// Maximum patterns to track
	maxPatterns?: number
	// Maximum mistakes to remember
	maxMistakes?: number
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Omit<Required<ContextConfig>, "context"> = {
	maxHistoryItems: 50,
	maxPatterns: 20,
	maxMistakes: 10,
}

/**
 * Keys for accessing global state
 * Following ClineProvider's pattern
 */
export type ContextStateKey =
	| "taskContext"
	| "technicalContext"
	| "userPreferences"
	| "commandHistory"
	| "patternHistory"
	| "mistakeHistory"

/**
 * Result of a context validation operation
 */
export interface ContextValidationResult {
	isValid: boolean
	missingFields: string[]
	warnings: string[]
}
