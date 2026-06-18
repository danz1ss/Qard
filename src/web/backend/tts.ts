/**
 * Web Speech API: синтез на лету. Desktop-контракт возвращает ArrayBuffer
 * с mp3; в web мы проигрываем звук сразу и возвращаем пустой ArrayBuffer
 * (UI использует факт успешного резолва, не сами байты, для произношения).
 */
function detectLang(text: string): string {
  return /[а-яА-ЯёЁ]/.test(text) ? 'ru-RU' : 'en-US';
}

export const webTTS = {
  async generateAudio(text: string): Promise<ArrayBuffer> {
    if (!('speechSynthesis' in window)) {
      throw new Error('Web Speech API not supported');
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = detectLang(text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return new ArrayBuffer(0);
  },
};
