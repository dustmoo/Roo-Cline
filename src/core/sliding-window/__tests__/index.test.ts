import { Anthropic } from "@anthropic-ai/sdk"
import { truncateHalfConversation, extractCriticalContext } from ".."
import { ContextManager } from "../../context"
import * as vscode from "vscode"

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

// Mock messages for testing
const createTestMessages = (): Anthropic.Messages.MessageParam[] => [
	{
		role: "user",
		content: [
			{
				type: "text" as const,
				text: "<task>\nImplement feature X\n</task>\n<environment_details>\nProject structure info\n</environment_details>",
			},
		],
	},
	{
		role: "assistant",
		content: [
			{
				type: "text" as const,
				text: "<thinking>Analyzing requirements</thinking>\nLet's break this down...",
			},
		],
	},
	{
		role: "user",
		content: [
			{
				type: "text" as const,
				text: "Here's some additional context...",
			},
		],
	},
	{
		role: "assistant",
		content: [
			{
				type: "text" as const,
				text: "<tool>write_to_file</tool>\nWriting implementation...",
			},
		],
	},
	{
		role: "user",
		content: [
			{
				type: "text" as const,
				text: "<feedback>Looks good, but consider adding tests</feedback>",
			},
		],
	},
	{
		role: "assistant",
		content: [
			{
				type: "text" as const,
				text: "Adding tests to implementation...",
			},
		],
	},
]

describe("Sliding Window", () => {
	let mockContextManager: ContextManager

	beforeEach(() => {
		mockContextManager = new ContextManager({
			context: mockContext as vscode.ExtensionContext,
			maxHistoryItems: 50,
			maxPatterns: 20,
			maxMistakes: 10,
		})
	})

	describe("truncateHalfConversation", () => {
		it("should always preserve the first task message", () => {
			const messages = createTestMessages()
			const truncated = truncateHalfConversation(messages, mockContextManager)

			expect(truncated[0]).toBe(messages[0])
			expect(truncated.length).toBeLessThan(messages.length)
		})

		it("should preserve messages with high importance scores", () => {
			const messages = createTestMessages()
			const truncated = truncateHalfConversation(messages, mockContextManager)

			// Check if messages with task, thinking, or feedback tags are preserved
			const preservedContent = truncated
				.map((m) =>
					Array.isArray(m.content) ? m.content.map((c) => ("text" in c ? c.text : "")).join("") : m.content,
				)
				.join("")

			expect(preservedContent).toContain("<task>")
			expect(preservedContent).toContain("<thinking>")
			expect(preservedContent).toContain("<feedback>")
		})

		it("should maintain conversation coherence", () => {
			const messages = createTestMessages()
			const truncated = truncateHalfConversation(messages, mockContextManager)

			// Verify role alternation
			for (let i = 1; i < truncated.length; i++) {
				expect(truncated[i].role).not.toBe(truncated[i - 1].role)
			}
		})

		it("should update context manager with preserved patterns", () => {
			const messages = createTestMessages()
			const truncated = truncateHalfConversation(messages, mockContextManager)

			const context = mockContextManager.getContext()
			expect(context.user.history.commonPatterns.length).toBeGreaterThan(0)
		})
	})

	describe("extractCriticalContext", () => {
		it("should extract patterns from messages", () => {
			const messages = createTestMessages()
			const { patterns, technicalDetails } = extractCriticalContext(messages)

			// Update test to handle multiline content
			const taskPattern = patterns.find((p) => p.includes("<task>") && p.includes("Implement feature X"))
			const thinkingPattern = patterns.find((p) => p.includes("<thinking>"))
			const feedbackPattern = patterns.find((p) => p.includes("<feedback>"))

			expect(taskPattern).toBeTruthy()
			expect(thinkingPattern).toBeTruthy()
			expect(feedbackPattern).toBeTruthy()
		})

		it("should extract technical details", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{
							type: "text" as const,
							text: "Let's create a file at `src/components/Feature.tsx`",
						},
					],
				},
			]

			const { technicalDetails } = extractCriticalContext(messages)
			expect(technicalDetails).toContain("`src/components/Feature.tsx`")
		})

		it("should deduplicate extracted information", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{
							type: "text" as const,
							text: "<pattern>test</pattern>\n<pattern>test</pattern>",
						},
					],
				},
			]

			const { patterns } = extractCriticalContext(messages)
			const patternCount = patterns.filter((p) => p === "<pattern>test</pattern>").length
			expect(patternCount).toBe(1)
		})
	})
})
