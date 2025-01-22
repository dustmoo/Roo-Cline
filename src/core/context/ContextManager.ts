import * as vscode from "vscode"
import {
	ContextMemory,
	ContextConfig,
	TaskContext,
	TechnicalContext,
	UserContext,
	ContextValidationResult,
	DEFAULT_CONFIG,
	ContextStateKey,
	ModeContextSettings,
} from "./types"

/**
 * Manages context memory persistence and operations using VSCode's state management
 */
export class ContextManager {
	private context: ContextMemory
	private config: Required<ContextConfig>

	constructor(config: ContextConfig) {
		this.config = {
			...DEFAULT_CONFIG,
			...config,
		}
		this.context = this.createEmptyContext()
	}

	/**
	 * Updates the current mode and its associated settings
	 */
	public async setMode(mode: string): Promise<void> {
		this.config.currentMode = mode
		await this.updateSettings({ currentMode: mode })
	}

	/**
	 * Gets the current mode's settings or falls back to defaults
	 */
	private getModeSettings(): ModeContextSettings {
		const modeSettings = this.config.modeSettings[this.config.currentMode]
		if (modeSettings) {
			return modeSettings
		}
		return {
			maxHistoryItems: this.config.maxHistoryItems,
			maxPatterns: this.config.maxPatterns,
			maxMistakes: this.config.maxMistakes,
		}
	}

	/**
	 * Checks if context memory is enabled
	 */
	private isEnabled(): boolean {
		return this.config.enabled
	}

	/**
	 * Creates an empty context structure
	 */
	private createEmptyContext(): ContextMemory {
		return {
			task: {
				id: "",
				scope: "",
				stage: "",
				progress: {
					completed: [],
					pending: [],
				},
				startTime: Date.now(),
				lastUpdateTime: Date.now(),
			},
			technical: {
				patterns: [],
				projectStructure: {
					root: "",
					mainFiles: [],
					dependencies: [],
				},
				lastAnalyzedFiles: [],
			},
			user: {
				preferences: {},
				history: {
					recentCommands: [],
					commonPatterns: [],
					mistakes: [],
				},
			},
		}
	}

	/**
	 * Updates global state with the specified key and value
	 */
	private async updateState(key: ContextStateKey, value: unknown): Promise<void> {
		await this.config.context.globalState.update(key, value)
	}

	/**
	 * Gets value from global state for the specified key
	 */
	private async getState<T>(key: ContextStateKey): Promise<T | undefined> {
		return this.config.context.globalState.get<T>(key)
	}

	/**
	 * Initializes a new task context
	 */
	public async initializeTaskContext(taskId: string, scope: string): Promise<void> {
		this.context.task = {
			id: taskId,
			scope,
			stage: "initializing",
			progress: {
				completed: [],
				pending: [],
			},
			startTime: Date.now(),
			lastUpdateTime: Date.now(),
		}
		await this.updateState("taskContext", this.context.task)
	}

	/**
	 * Updates the task stage and progress
	 */
	public async updateTaskProgress(stage: string, completed?: string[], pending?: string[]): Promise<void> {
		this.context.task.stage = stage
		if (completed) {
			this.context.task.progress.completed = completed
		}
		if (pending) {
			this.context.task.progress.pending = pending
		}
		this.context.task.lastUpdateTime = Date.now()
		await this.updateState("taskContext", this.context.task)
	}

	/**
	 * Updates technical context with new information
	 */
	public async updateTechnicalContext(updates: Partial<TechnicalContext>): Promise<void> {
		this.context.technical = {
			...this.context.technical,
			...updates,
		}
		await this.updateState("technicalContext", this.context.technical)
	}

	/**
	 * Updates user preferences
	 */
	public async updateUserPreferences(preferences: UserContext["preferences"]): Promise<void> {
		this.context.user.preferences = {
			...this.context.user.preferences,
			...preferences,
		}
		await this.updateState("userPreferences", this.context.user.preferences)
	}

	/**
	 * Adds a command to recent history
	 */
	public async addCommandToHistory(command: string): Promise<void> {
		if (!this.isEnabled()) return

		this.context.user.history.recentCommands.unshift({
			command,
			timestamp: Date.now(),
		})

		// Maintain max history size based on mode settings
		const { maxHistoryItems } = this.getModeSettings()
		if (this.context.user.history.recentCommands.length > maxHistoryItems) {
			this.context.user.history.recentCommands.pop()
		}

		await this.updateState("commandHistory", this.context.user.history.recentCommands)
	}

	/**
	 * Records a pattern occurrence
	 */
	public async recordPattern(pattern: string): Promise<void> {
		if (!this.isEnabled()) return

		const existing = this.context.user.history.commonPatterns.find((p) => p.pattern === pattern)
		if (existing) {
			existing.occurrences++
		} else {
			this.context.user.history.commonPatterns.push({
				pattern,
				occurrences: 1,
			})
		}

		// Sort by occurrences and maintain max size based on mode settings
		this.context.user.history.commonPatterns.sort((a, b) => b.occurrences - a.occurrences)
		const { maxPatterns } = this.getModeSettings()
		if (this.context.user.history.commonPatterns.length > maxPatterns) {
			this.context.user.history.commonPatterns.pop()
		}

		await this.updateState("patternHistory", this.context.user.history.commonPatterns)
	}

	/**
	 * Records a mistake for learning
	 */
	public async recordMistake(type: string, description: string): Promise<void> {
		if (!this.isEnabled()) return

		this.context.user.history.mistakes.unshift({
			type,
			description,
			timestamp: Date.now(),
		})

		// Maintain max size based on mode settings
		const { maxMistakes } = this.getModeSettings()
		if (this.context.user.history.mistakes.length > maxMistakes) {
			this.context.user.history.mistakes.pop()
		}

		await this.updateState("mistakeHistory", this.context.user.history.mistakes)
	}

	/**
	 * Validates the current context state
	 */
	public validateContext(): ContextValidationResult {
		const missingFields: string[] = []
		const warnings: string[] = []

		// Validate task context
		if (!this.context.task.id) missingFields.push("task.id")
		if (!this.context.task.scope) missingFields.push("task.scope")
		if (!this.context.task.stage) missingFields.push("task.stage")

		// Add warnings for potentially incomplete data
		if (this.context.task.progress.pending.length === 0) {
			warnings.push("No pending tasks defined")
		}
		if (!this.context.technical.projectStructure.root) {
			warnings.push("Project root not set")
		}

		return {
			isValid: missingFields.length === 0,
			missingFields,
			warnings,
		}
	}

	/**
	 * Gets the current context state
	 */
	public getContext(): ContextMemory {
		return { ...this.context }
	}

	/**
	 * Gets a condensed version of the context for inclusion in prompts
	 */
	public getContextSummary(): string {
		return `Current Task: ${this.context.task.scope} (Stage: ${this.context.task.stage})
Technical Context: ${this.context.technical.language || "Not set"} / ${this.context.technical.framework || "Not set"}
Recent Patterns: ${this.context.user.history.commonPatterns
			.slice(0, 3)
			.map((p) => p.pattern)
			.join(", ")}
Progress: ${this.context.task.progress.completed.length} steps completed, ${this.context.task.progress.pending.length} pending
Context Memory: ${this.isEnabled() ? "Enabled" : "Disabled"} (Mode: ${this.config.currentMode})`
	}

	/**
	 * Updates context memory settings
	 */
	public async updateSettings(settings: Partial<ContextConfig>): Promise<void> {
		this.config = {
			...this.config,
			...settings,
		}
		await this.updateState("contextSettings", {
			enabled: this.config.enabled,
			modeSettings: this.config.modeSettings,
		})
	}

	/**
	 * Gets current context memory settings
	 */
	public getSettings(): {
		enabled: boolean
		currentMode: string
		modeSettings: Record<string, ModeContextSettings>
	} {
		return {
			enabled: this.config.enabled,
			currentMode: this.config.currentMode,
			modeSettings: this.config.modeSettings,
		}
	}
}
