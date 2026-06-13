import axios from 'axios'

const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';

interface AnkiConnectRequest {
  action: string;
  version: 6;
  params?: any;
}

interface AnkiConnectResponse {
  result: any;
  error: string | null;
}

export interface AnkiNoteInfo {
  noteId: number;
  modelName: string;
  tags: string[];
  fields: { [name: string]: { value: string; order: number } };
}

class AnkiConnectService {
  private async invoke(action: string, params: any = {}): Promise<any> {
    const request: AnkiConnectRequest = {
      action,
      version: 6,
      params
    };

    try {
      const response = await axios.post<AnkiConnectResponse>(
        ANKI_CONNECT_URL,
        request,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      return response.data.result;
    } catch (error: any) {
      console.error('AnkiConnect error:', error.message);

      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          'Cannot connect to Anki. Please make sure Anki is running and AnkiConnect addon is installed.'
        );
      }

      if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        throw new Error(
          'Connection timeout. Please check if Anki is running and AnkiConnect addon is enabled.'
        );
      }

      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw new Error(
          `AnkiConnect error (HTTP ${error.response.status}): ${error.response.statusText}`
        );
      }

      // Re-throw original error with more context
      throw new Error(`AnkiConnect request failed: ${error.message}`);
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.invoke('version');
      return true;
    } catch (error) {
      return false;
    }
  }

  async getDeckNames(): Promise<string[]> {
    return await this.invoke('deckNames');
  }

  /**
   * Returns note IDs matching an Anki search query.
   * Used to detect whether a word already exists in a deck.
   */
  async findNotes(query: string): Promise<number[]> {
    return await this.invoke('findNotes', { query });
  }

  async notesInfo(notes: number[]): Promise<AnkiNoteInfo[]> {
    return await this.invoke('notesInfo', { notes });
  }

  /** Возвращает base64 содержимого медиафайла или false, если файла нет. */
  async retrieveMediaFile(filename: string): Promise<string | false> {
    return await this.invoke('retrieveMediaFile', { filename });
  }

}

export const ankiConnectService = new AnkiConnectService();
