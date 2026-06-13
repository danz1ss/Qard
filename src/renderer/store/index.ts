import { create } from 'zustand'
import {
	DataSource,
	DeckWithCounts,
	FieldMapping,
	GeneratedCard,
	GenerationProgress,
	GenerationStage,
} from '../../shared/types'

// Auto-mapping helper: intelligently maps field names to data sources
function autoMapFields(fieldNames: string[]): FieldMapping {
	const mapping: FieldMapping = {}

	for (const fieldName of fieldNames) {
		const lowerField = fieldName.toLowerCase().trim()

		// Match Word field
		if (
			lowerField === 'word' ||
			lowerField === 'english' ||
			lowerField === 'front'
		) {
			mapping[fieldName] = DataSource.Word
		}
		// Match Word Type field
		else if (
			lowerField === 'word type' ||
			lowerField === 'type' ||
			lowerField === 'part of speech' ||
			lowerField === 'pos'
		) {
			mapping[fieldName] = DataSource.WordType
		}
		// Match Definition field
		else if (
			lowerField === 'definition' ||
			lowerField === 'meaning' ||
			lowerField === 'back'
		) {
			mapping[fieldName] = DataSource.Definition
		}
		// Match Definition Example field
		else if (
			lowerField === 'definition example' ||
			lowerField === 'def example'
		) {
			mapping[fieldName] = DataSource.DefinitionExample
		}
		// Match Transcription field
		else if (
			lowerField === 'transcription' ||
			lowerField === 'ipa' ||
			lowerField === 'pronunciation' ||
			lowerField === 'phonetic'
		) {
			mapping[fieldName] = DataSource.Transcription
		}
		// Match Examples field
		else if (
			lowerField === 'example' ||
			lowerField === 'examples' ||
			lowerField === 'example(s)' ||
			lowerField === 'context'
		) {
			mapping[fieldName] = DataSource.Examples
		}
		// Match Word Audio field
		else if (
			lowerField === 'audio' ||
			lowerField === 'sound' ||
			lowerField === 'word audio' ||
			lowerField === 'pronunciation audio'
		) {
			mapping[fieldName] = DataSource.WordAudio
		}
		// Match Example Type field
		else if (
			lowerField === 'example type' ||
			lowerField === 'word form' ||
			lowerField === 'related form'
		) {
			mapping[fieldName] = DataSource.ExampleType
		}
		// Default to None for unrecognized fields
		else {
			mapping[fieldName] = DataSource.None
		}
	}

	return mapping
}

interface AppState {
	// Words slice
	words: string[]
	setWords: (words: string[]) => void

	// Settings slice
	geminiApiKey: string
	aiProvider: string
	aiModel: string
	aiBaseUrl: string
	selectedDeck: string
	selectedModel: string
	exampleCount: number
	fieldMapping: FieldMapping
	availableDecks: string[]
	availableModels: string[]
	availableFields: string[]

	setGeminiApiKey: (key: string) => void
	setAiProvider: (provider: string) => void
	setAiModel: (model: string) => void
	setAiBaseUrl: (url: string) => void
	setSelectedDeck: (deck: string) => void
	setSelectedModel: (model: string) => void
	setExampleCount: (count: number) => void
	setFieldMapping: (mapping: FieldMapping) => void
	setAvailableDecks: (decks: string[]) => void
	setAvailableModels: (models: string[]) => void
	setAvailableFields: (fields: string[]) => void

	loadSettings: () => Promise<void>
	saveSettings: () => Promise<void>

	// Generation slice
	generatedCards: GeneratedCard[]
	generationProgress: GenerationProgress
	isGenerating: boolean

	setGeneratedCards: (cards: GeneratedCard[]) => void
	addGeneratedCard: (card: GeneratedCard) => void
	removeGeneratedCard: (id: string) => void
	setGenerationProgress: (progress: GenerationProgress) => void
	setIsGenerating: (isGenerating: boolean) => void
	resetGeneration: () => void

	// Anki connection status
	ankiConnected: boolean
	setAnkiConnected: (connected: boolean) => void

	// Local collection slice
	decks: DeckWithCounts[]
	refreshDecks: () => Promise<void>
	defaultDeckId: number | null
	setDefaultDeckId: (id: number | null) => void
}

export const useStore = create<AppState>((set, get) => ({
	// Words state
	words: [],
	setWords: words => set({ words }),

	// Settings state
	geminiApiKey: '',
	aiProvider: 'proxyapi',
	aiModel: 'gpt-4o-mini',
	aiBaseUrl: '',
	selectedDeck: '',
	selectedModel: '',
	exampleCount: 3,
	fieldMapping: {},
	availableDecks: [],
	availableModels: [],
	availableFields: [],

	setGeminiApiKey: key => set({ geminiApiKey: key }),
	setAiProvider: provider => set({ aiProvider: provider }),
	setAiModel: model => set({ aiModel: model }),
	setAiBaseUrl: url => set({ aiBaseUrl: url }),
	setSelectedDeck: deck => {
		set({ selectedDeck: deck })
		// Persist immediately so the selection can't silently revert to a
		// stale value on remount/reload (root cause of "deck was not found").
		window.electronAPI.settings
			.set('selectedDeck', deck)
			.catch(error => console.error('Failed to persist selectedDeck:', error))
	},
	setSelectedModel: async model => {
		set({ selectedModel: model })
		window.electronAPI.settings
			.set('selectedModel', model)
			.catch(error => console.error('Failed to persist selectedModel:', error))

		// Load fields for the selected model
		if (model) {
			try {
				const fields = await window.electronAPI.anki.getModelFields(model)
				set({ availableFields: fields })

				// Auto-map fields based on field names
				const autoMapping = autoMapFields(fields)
				set({ fieldMapping: autoMapping })
			} catch (error) {
				console.error('Failed to load model fields:', error)
			}
		}
	},
	setExampleCount: count => set({ exampleCount: count }),
	setFieldMapping: mapping => set({ fieldMapping: mapping }),
	setAvailableDecks: decks => set({ availableDecks: decks }),
	setAvailableModels: models => set({ availableModels: models }),
	setAvailableFields: fields => set({ availableFields: fields }),

	loadSettings: async () => {
		try {
			const settings = await window.electronAPI.settings.getAll()
			set({
				geminiApiKey: settings.geminiApiKey || '',
				aiProvider: settings.aiProvider || 'proxyapi',
				aiModel: settings.aiModel || 'gpt-4o-mini',
				aiBaseUrl: settings.aiBaseUrl || '',
				selectedDeck: settings.selectedDeck || '',
				selectedModel: settings.selectedModel || '',
				exampleCount: settings.exampleCount || 3,
				fieldMapping: settings.fieldMapping || {},
				defaultDeckId: settings.defaultDeckId ?? null,
			})

			// Load available fields if model is selected
			if (settings.selectedModel) {
				const fields = await window.electronAPI.anki.getModelFields(
					settings.selectedModel,
				)
				set({ availableFields: fields })

				// If no field mapping exists, auto-map based on field names
				if (
					!settings.fieldMapping ||
					Object.keys(settings.fieldMapping).length === 0
				) {
					const autoMapping = autoMapFields(fields)
					set({ fieldMapping: autoMapping })
				}
			}
		} catch (error) {
			console.error('Failed to load settings:', error)
		}
	},

	saveSettings: async () => {
		const state = get()
		try {
			await window.electronAPI.settings.set('aiProvider', state.aiProvider)
			await window.electronAPI.settings.set('aiModel', state.aiModel)
			await window.electronAPI.settings.set('aiBaseUrl', state.aiBaseUrl)
			await window.electronAPI.settings.set('geminiApiKey', state.geminiApiKey)
			await window.electronAPI.settings.set('selectedDeck', state.selectedDeck)
			await window.electronAPI.settings.set(
				'selectedModel',
				state.selectedModel,
			)
			await window.electronAPI.settings.set('exampleCount', state.exampleCount)
			await window.electronAPI.settings.set('fieldMapping', state.fieldMapping)
		} catch (error) {
			console.error('Failed to save settings:', error)
			throw error
		}
	},

	// Generation state
	generatedCards: [],
	generationProgress: {
		currentWord: '',
		currentStage: GenerationStage.Idle,
		completedCards: 0,
		totalCards: 0,
	},
	isGenerating: false,

	setGeneratedCards: cards => set({ generatedCards: cards }),
	addGeneratedCard: card =>
		set(state => ({
			generatedCards: [...state.generatedCards, card],
		})),
	removeGeneratedCard: id =>
		set(state => ({
			generatedCards: state.generatedCards.filter(c => c.id !== id),
		})),
	setGenerationProgress: progress => set({ generationProgress: progress }),
	setIsGenerating: isGenerating => set({ isGenerating }),
	resetGeneration: () =>
		set({
			generatedCards: [],
			generationProgress: {
				currentWord: '',
				currentStage: GenerationStage.Idle,
				completedCards: 0,
				totalCards: 0,
			},
			isGenerating: false,
		}),

	// Anki connection
	ankiConnected: false,
	setAnkiConnected: connected => set({ ankiConnected: connected }),

	// Local collection
	decks: [],
	refreshDecks: async () => {
		try {
			const decks = await window.electronAPI.collection.listDecks()
			set({ decks })
		} catch (error) {
			console.error('Failed to load decks:', error)
		}
	},
	defaultDeckId: null,
	setDefaultDeckId: id => {
		set({ defaultDeckId: id })
		window.electronAPI.settings
			.set('defaultDeckId', id)
			.catch(error => console.error('Failed to persist defaultDeckId:', error))
	},
}))
