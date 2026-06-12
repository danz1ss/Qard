import axios from 'axios'

const GOOGLE_TTS_URL = 'https://translate.google.com/translate_tts'

class TTSService {
	async generateAudio(text: string): Promise<Buffer> {
		// Detect language: if contains Cyrillic -> ru, else -> en
		const isCyrillic = /[а-яА-ЯёЁ]/.test(text)
		const lang = isCyrillic ? 'ru' : 'en'

		try {
			const response = await axios.get(GOOGLE_TTS_URL, {
				params: {
					ie: 'UTF-8',
					tl: lang,
					client: 'tw-ob',
					q: text,
				},
				responseType: 'arraybuffer',
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
				},
			})

			return Buffer.from(response.data)
		} catch (error: any) {
			console.error('TTS generation error:', error)
			throw new Error(`Failed to generate audio: ${error.message}`)
		}
	}
}

export const ttsService = new TTSService()
