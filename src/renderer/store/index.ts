import { create } from 'zustand'
import {
	DeckWithCounts,
	GeneratedCard,
	GenerationProgress,
	GenerationStage,
	StudyStats,
} from '../../shared/types'

interface AppState {
	// Words slice
	words: string[]
	setWords: (words: string[]) => void

	// Settings slice
	geminiApiKey: string
	aiProvider: string
	aiModel: string
	aiBaseUrl: string
	exampleCount: number
	dailyGoal: number

	setGeminiApiKey: (key: string) => void
	setAiProvider: (provider: string) => void
	setAiModel: (model: string) => void
	setAiBaseUrl: (url: string) => void
	setExampleCount: (count: number) => void
	setDailyGoal: (goal: number) => void

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

	// Local collection slice
	decks: DeckWithCounts[]
	refreshDecks: () => Promise<void>
	defaultDeckId: number | null
	setDefaultDeckId: (id: number | null) => void

	// Study stats slice
	stats: StudyStats | null
	refreshStats: () => Promise<void>
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
	exampleCount: 3,
	dailyGoal: 20,

	setGeminiApiKey: key => set({ geminiApiKey: key }),
	setAiProvider: provider => set({ aiProvider: provider }),
	setAiModel: model => set({ aiModel: model }),
	setAiBaseUrl: url => set({ aiBaseUrl: url }),
	setExampleCount: count => set({ exampleCount: count }),
	setDailyGoal: goal => set({ dailyGoal: goal }),

	loadSettings: async () => {
		try {
			const settings = await window.electronAPI.settings.getAll()
			set({
				geminiApiKey: settings.geminiApiKey || '',
				aiProvider: settings.aiProvider || 'proxyapi',
				aiModel: settings.aiModel || 'gpt-4o-mini',
				aiBaseUrl: settings.aiBaseUrl || '',
				exampleCount: Math.min(settings.exampleCount || 3, 3),
				dailyGoal: Math.min(settings.dailyGoal || 20, 20),
				defaultDeckId: settings.defaultDeckId ?? null,
			})
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
			await window.electronAPI.settings.set('exampleCount', state.exampleCount)
			await window.electronAPI.settings.set('dailyGoal', state.dailyGoal)
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

	// Study stats
	stats: null,
	refreshStats: async () => {
		try {
			const stats = await window.electronAPI.stats.get()
			set({ stats })
		} catch (error) {
			console.error('Failed to load study stats:', error)
		}
	},
}))
