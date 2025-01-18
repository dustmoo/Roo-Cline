import { ContextMemory, ContextValidationResult } from "./types"

/**
 * Validation rules for different context scenarios
 */
interface ValidationRule {
	validate: (context: ContextMemory) => { valid: boolean; message?: string }
	severity: "error" | "warning"
}

/**
 * Core validation rules for context memory
 */
const contextValidationRules: Record<string, ValidationRule> = {
	taskInitialization: {
		validate: (context) => ({
			valid: Boolean(context.task.id && context.task.scope),
			message: "Task must have both ID and scope defined",
		}),
		severity: "error",
	},
	taskProgress: {
		validate: (context) => ({
			valid: context.task.progress.completed.length > 0 || context.task.progress.pending.length > 0,
			message: "Task should have either completed or pending steps",
		}),
		severity: "warning",
	},
	technicalContext: {
		validate: (context) => ({
			valid: Boolean(context.technical.projectStructure.root),
			message: "Project root path must be defined",
		}),
		severity: "error",
	},
	recentActivity: {
		validate: (context) => ({
			valid: Date.now() - context.task.lastUpdateTime < 30 * 60 * 1000, // 30 minutes
			message: "Context may be stale (no updates in last 30 minutes)",
		}),
		severity: "warning",
	},
}

/**
 * Validates context for specific operations
 */
export const contextValidators = {
	/**
	 * Validates context for tool execution
	 */
	validateForToolUse(context: ContextMemory): ContextValidationResult {
		const missingFields: string[] = []
		const warnings: string[] = []

		// Check core requirements
		if (!context.task.id) missingFields.push("task.id")
		if (!context.task.scope) missingFields.push("task.scope")
		if (!context.task.stage) missingFields.push("task.stage")

		// Check technical context
		if (!context.technical.projectStructure.root) {
			missingFields.push("technical.projectStructure.root")
		}

		// Add warnings for potentially problematic states
		if (context.task.progress.pending.length === 0) {
			warnings.push("No pending tasks defined - tool use may lack proper context")
		}
		if (Date.now() - context.task.lastUpdateTime > 30 * 60 * 1000) {
			warnings.push("Context may be stale (no updates in last 30 minutes)")
		}

		return {
			isValid: missingFields.length === 0,
			missingFields,
			warnings,
		}
	},

	/**
	 * Validates context for task completion
	 */
	validateForCompletion(context: ContextMemory): ContextValidationResult {
		const missingFields: string[] = []
		const warnings: string[] = []

		// Ensure all necessary task data is present
		if (!context.task.id) missingFields.push("task.id")
		if (!context.task.scope) missingFields.push("task.scope")

		// Check task progress
		if (context.task.progress.pending.length > 0) {
			warnings.push("Task has pending steps that haven't been completed")
		}
		if (context.task.progress.completed.length === 0) {
			warnings.push("No completed steps recorded for this task")
		}

		return {
			isValid: missingFields.length === 0,
			missingFields,
			warnings,
		}
	},

	/**
	 * Validates context completeness
	 */
	validateContextCompleteness(context: ContextMemory): ContextValidationResult {
		const missingFields: string[] = []
		const warnings: string[] = []

		// Apply all validation rules
		Object.entries(contextValidationRules).forEach(([key, rule]) => {
			const result = rule.validate(context)
			if (!result.valid && result.message) {
				if (rule.severity === "error") {
					missingFields.push(`${key}: ${result.message}`)
				} else {
					warnings.push(result.message)
				}
			}
		})

		return {
			isValid: missingFields.length === 0,
			missingFields,
			warnings,
		}
	},
}

/**
 * Utility functions for context validation
 */
export const validationUtils = {
	/**
	 * Checks if the technical context is sufficient for the current task
	 */
	hasSufficientTechnicalContext(context: ContextMemory): boolean {
		return Boolean(
			context.technical.projectStructure.root && context.technical.projectStructure.mainFiles.length > 0,
		)
	},

	/**
	 * Checks if the context is fresh enough to be reliable
	 */
	isContextFresh(context: ContextMemory): boolean {
		const maxAge = 30 * 60 * 1000 // 30 minutes
		return Date.now() - context.task.lastUpdateTime < maxAge
	},

	/**
	 * Checks if there are any blocking issues in the context
	 */
	hasBlockingIssues(context: ContextMemory): boolean {
		const { isValid } = contextValidators.validateContextCompleteness(context)
		return !isValid
	},
}
