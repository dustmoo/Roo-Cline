import { Anthropic } from "@anthropic-ai/sdk"
import { ContextManager } from "../context"

interface MessageImportance {
	score: number
	reason: string
}

/**
 * Analyzes a message to determine its importance for context preservation
 */
function analyzeMessageImportance(message: Anthropic.Messages.MessageParam): MessageImportance {
	let score = 0
	const reasons: string[] = []

	// Helper to check if content contains specific patterns
	const containsPattern = (content: string, pattern: string): boolean =>
		content.toLowerCase().includes(pattern.toLowerCase())

	// Convert message content to string for analysis
	const contentStr = Array.isArray(message.content)
		? message.content
				.map((block) => {
					if (typeof block === "string") return block
					if ("text" in block) return block.text
					return ""
				})
				.join("\n")
		: String(message.content)

	// Check for important context indicators
	if (containsPattern(contentStr, "<task>")) {
		score += 10
		reasons.push("Contains task definition")
	}

	if (containsPattern(contentStr, "environment_details")) {
		score += 8
		reasons.push("Contains environment details")
	}

	if (containsPattern(contentStr, "<thinking>")) {
		score += 5
		reasons.push("Contains thought process")
	}

	// Check for tool usage patterns
	if (message.role === "assistant" && containsPattern(contentStr, "<tool_")) {
		score += 6
		reasons.push("Contains tool usage")
	}

	// Check for user feedback
	if (message.role === "user" && containsPattern(contentStr, "<feedback>")) {
		score += 7
		reasons.push("Contains user feedback")
	}

	// Check for error context
	if (containsPattern(contentStr, "<error>") || containsPattern(contentStr, "error:")) {
		score += 4
		reasons.push("Contains error context")
	}

	return {
		score,
		reason: reasons.join(", "),
	}
}

/**
 * Enhanced truncation that preserves critical context
 */
export function truncateHalfConversation(
	messages: Anthropic.Messages.MessageParam[],
	contextManager?: ContextManager,
): Anthropic.Messages.MessageParam[] {
	// Always keep the first Task message
	const truncatedMessages = [messages[0]]

	// Analyze importance of remaining messages
	const messageScores: Array<{ message: Anthropic.Messages.MessageParam; importance: MessageImportance }> = messages
		.slice(1)
		.map((message) => ({
			message,
			importance: analyzeMessageImportance(message),
		}))

	// Sort messages by importance score
	messageScores.sort((a, b) => b.importance.score - a.importance.score)

	// Calculate how many messages we need to remove
	const targetLength = Math.ceil(messages.length / 2)
	const messagesToKeep = messageScores
		.slice(0, targetLength - 1) // -1 because we already kept the first message
		.map((item) => item.message)

	// Restore original order for messages we're keeping
	const messageIndices = new Map(messages.map((msg, idx) => [msg, idx]))
	messagesToKeep.sort((a, b) => {
		const indexA = messageIndices.get(a) ?? 0
		const indexB = messageIndices.get(b) ?? 0
		return indexA - indexB
	})

	// Update context manager if provided
	if (contextManager) {
		// Extract and preserve critical information before truncation
		const preservedPatterns = new Set<string>()
		messageScores.forEach(({ message, importance }) => {
			if (importance.score >= 5) {
				// Threshold for pattern preservation
				const content = Array.isArray(message.content)
					? message.content
							.map((block) => (typeof block === "string" ? block : "text" in block ? block.text : ""))
							.join("\n")
					: String(message.content)

				// Extract and record patterns from important messages
				const patterns = content.match(/<([^>]+)>[^<]*<\/\1>/g) || []
				patterns.forEach((pattern) => preservedPatterns.add(pattern))
			}
		})

		// Record preserved patterns in context
		preservedPatterns.forEach((pattern) => {
			contextManager.recordPattern(pattern)
		})
	}

	truncatedMessages.push(...messagesToKeep)

	return truncatedMessages
}

/**
 * Extracts critical context from a conversation for preservation
 */
export function extractCriticalContext(messages: Anthropic.Messages.MessageParam[]): {
	patterns: string[]
	technicalDetails: string[]
} {
	const patterns: string[] = []
	const technicalDetails: string[] = []

	messages.forEach((message) => {
		const content = Array.isArray(message.content)
			? message.content
					.map((block) => (typeof block === "string" ? block : "text" in block ? block.text : ""))
					.join("\n")
			: String(message.content)

		// Extract patterns (XML-like tags with content)
		const patternMatches = content.match(/<([^>]+)>[^<]*<\/\1>/g) || []
		patterns.push(...patternMatches)

		// Extract technical details (file paths, commands, etc.)
		const technicalMatches = content.match(/(?:\/[\w.-]+)+|\`[^`]+\`/g) || []
		technicalDetails.push(...technicalMatches)
	})

	return {
		patterns: [...new Set(patterns)],
		technicalDetails: [...new Set(technicalDetails)],
	}
}
