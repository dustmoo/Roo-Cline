import * as vscode from "vscode"
import { ContextManager } from "../ContextManager"
import { contextValidators } from "../validation"
import { ContextMemory, ContextConfig } from "../types"

// Mock minimal required ExtensionContext properties
const mockGlobalState: vscode.Memento & { setKeysForSync(keys: readonly string[]): void } = {
	get: jest.fn(),
	update: jest.fn().mockResolvedValue(undefined),
	keys: jest.fn().mockReturnValue([]),
	setKeysForSync: jest.fn(),
}

const mockContext: Pick<vscode.ExtensionContext, "globalState" | "extensionMode" | "extensionUri"> = {
	globalState: mockGlobalState,
	extensionMode: vscode.ExtensionMode.Development,
	extensionUri: {
		fsPath: "/test/path",
		scheme: "file",
	} as vscode.Uri,
}

describe("ContextManager", () => {
	let contextManager: ContextManager

	beforeEach(() => {
		jest.clearAllMocks()
		const config: ContextConfig = {
			context: mockContext as vscode.ExtensionContext,
			maxHistoryItems: 50,
			maxPatterns: 20,
			maxMistakes: 10,
		}
		contextManager = new ContextManager(config)
	})

	describe("Task Context Management", () => {
		it("should initialize task context correctly", async () => {
			const taskId = "test-task-1"
			const scope = "implement feature X"

			await contextManager.initializeTaskContext(taskId, scope)
			const context = contextManager.getContext()

			expect(context.task.id).toBe(taskId)
			expect(context.task.scope).toBe(scope)
			expect(context.task.stage).toBe("initializing")
			expect(context.task.progress.completed).toEqual([])
			expect(context.task.progress.pending).toEqual([])
			expect(mockGlobalState.update).toHaveBeenCalledWith("taskContext", expect.any(Object))
		})

		it("should update task progress correctly", async () => {
			const completed = ["step 1", "step 2"]
			const pending = ["step 3"]

			await contextManager.initializeTaskContext("test-task", "test scope")
			await contextManager.updateTaskProgress("in_progress", completed, pending)

			const context = contextManager.getContext()
			expect(context.task.stage).toBe("in_progress")
			expect(context.task.progress.completed).toEqual(completed)
			expect(context.task.progress.pending).toEqual(pending)
			expect(mockGlobalState.update).toHaveBeenCalledWith("taskContext", expect.any(Object))
		})
	})

	describe("Technical Context Management", () => {
		it("should update technical context correctly", async () => {
			const technicalContext = {
				framework: "react",
				language: "typescript",
				patterns: ["component-based", "hooks"],
				projectStructure: {
					root: "/test/project",
					mainFiles: ["index.ts"],
					dependencies: ["react", "typescript"],
				},
				lastAnalyzedFiles: ["src/index.ts"],
			}

			await contextManager.updateTechnicalContext(technicalContext)
			const context = contextManager.getContext()

			expect(context.technical).toEqual(technicalContext)
			expect(mockGlobalState.update).toHaveBeenCalledWith("technicalContext", expect.any(Object))
		})
	})

	describe("User Context Management", () => {
		it("should update user preferences correctly", async () => {
			const preferences = {
				language: "english",
				style: ["functional", "modular"],
			}

			await contextManager.updateUserPreferences(preferences)
			const context = contextManager.getContext()

			expect(context.user.preferences).toEqual(preferences)
			expect(mockGlobalState.update).toHaveBeenCalledWith("userPreferences", expect.any(Object))
		})

		it("should manage command history correctly", async () => {
			const command = "git commit -m 'test'"
			await contextManager.addCommandToHistory(command)

			const context = contextManager.getContext()
			expect(context.user.history.recentCommands[0].command).toBe(command)
			expect(mockGlobalState.update).toHaveBeenCalledWith("commandHistory", expect.any(Array))
		})

		it("should record and manage patterns correctly", async () => {
			const pattern = "component-pattern"
			await contextManager.recordPattern(pattern)
			await contextManager.recordPattern(pattern) // Record twice

			const context = contextManager.getContext()
			const recordedPattern = context.user.history.commonPatterns.find((p) => p.pattern === pattern)

			expect(recordedPattern).toBeDefined()
			expect(recordedPattern?.occurrences).toBe(2)
			expect(mockGlobalState.update).toHaveBeenCalledWith("patternHistory", expect.any(Array))
		})
	})

	describe("Context Validation", () => {
		it("should validate complete context correctly", async () => {
			await contextManager.initializeTaskContext("test-task", "test scope")
			await contextManager.updateTaskProgress("in_progress", ["step1"], ["step2"])
			await contextManager.updateTechnicalContext({
				projectStructure: {
					root: "/test/project",
					mainFiles: ["index.ts"],
					dependencies: [],
				},
				patterns: [],
				lastAnalyzedFiles: [],
			})

			const result = contextValidators.validateContextCompleteness(contextManager.getContext())
			expect(result.isValid).toBe(true)
			expect(result.missingFields).toHaveLength(0)
		})

		it("should identify missing required fields", () => {
			const result = contextValidators.validateContextCompleteness(contextManager.getContext())
			expect(result.isValid).toBe(false)
			expect(result.missingFields.length).toBeGreaterThan(0)
		})
	})

	describe("Context Summary", () => {
		it("should generate meaningful context summary", async () => {
			await contextManager.initializeTaskContext("summary-test", "test summary")
			await contextManager.updateTaskProgress("in_progress", ["step1"], ["step2", "step3"])
			await contextManager.updateTechnicalContext({
				language: "typescript",
				framework: "react",
				patterns: [],
				projectStructure: {
					root: "/test/project",
					mainFiles: [],
					dependencies: [],
				},
				lastAnalyzedFiles: [],
			})

			const summary = contextManager.getContextSummary()
			expect(summary).toContain("test summary")
			expect(summary).toContain("typescript")
			expect(summary).toContain("react")
			expect(summary).toContain("1 steps completed")
			expect(summary).toContain("2 pending")
		})
	})
})
