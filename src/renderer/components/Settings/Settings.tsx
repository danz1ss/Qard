import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import FieldMapper from './FieldMapper';
import { AI_PROVIDERS } from '../../../shared/types';
import './Settings.css';

const Settings: React.FC = () => {
  const {
    geminiApiKey,
    aiProvider,
    aiModel,
    aiBaseUrl,
    selectedDeck,
    selectedModel,
    exampleCount,
    fieldMapping,
    availableDecks,
    availableModels,
    availableFields,
    ankiConnected,
    setGeminiApiKey,
    setAiProvider,
    setAiModel,
    setAiBaseUrl,
    setSelectedDeck,
    setSelectedModel,
    setExampleCount,
    setFieldMapping,
    setAvailableDecks,
    setAvailableModels,
    setAnkiConnected,
    loadSettings,
    saveSettings
  } = useStore();

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAnki, setIsLoadingAnki] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    loadSettings();
    checkAnkiConnection();
  }, []);

  const checkAnkiConnection = async () => {
    setIsLoadingAnki(true);
    try {
      const connected = await window.electronAPI.anki.checkConnection();
      setAnkiConnected(connected);

      if (connected) {
        const [decks, models] = await Promise.all([
          window.electronAPI.anki.getDecks(),
          window.electronAPI.anki.getModels()
        ]);

        setAvailableDecks(decks);
        setAvailableModels(models);

        // Drop stale persisted selections that no longer exist in Anki,
        // otherwise the dropdown shows "Select a deck..." while the store
        // still holds a deleted deck name and addNotes fails with
        // "deck was not found". Read fresh state to avoid a render-closure
        // race with loadSettings (both run on mount).
        const { selectedDeck: curDeck, selectedModel: curModel } =
          useStore.getState();
        if (curDeck && !decks.includes(curDeck)) {
          setSelectedDeck('');
        }
        if (curModel && !models.includes(curModel)) {
          setSelectedModel('');
        }
      }
    } catch (error) {
      console.error('Failed to check Anki connection:', error);
      setAnkiConnected(false);
    } finally {
      setIsLoadingAnki(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      await saveSettings();
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error: any) {
      setSaveMessage(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const currentProvider =
    AI_PROVIDERS.find((p) => p.id === aiProvider) || AI_PROVIDERS[0];
  const isCustomProvider = aiProvider === 'custom';

  const providerOptions = AI_PROVIDERS.map((p) => ({
    value: p.id,
    label: p.label
  }));
  const aiModelOptions = currentProvider.models.map((m) => ({
    value: m,
    label: m
  }));

  const handleProviderChange = (providerId: string) => {
    setAiProvider(providerId);
    const preset = AI_PROVIDERS.find((p) => p.id === providerId);
    if (preset && preset.defaultModel) {
      setAiModel(preset.defaultModel);
    }
  };

  const deckOptions = [
    { value: '', label: 'Select a deck...' },
    ...availableDecks.map((deck) => ({ value: deck, label: deck }))
  ];

  const modelOptions = [
    { value: '', label: 'Select a model...' },
    ...availableModels.map((model) => ({ value: model, label: model }))
  ];

  const exampleCountOptions = [
    { value: '1', label: '1 example' },
    { value: '2', label: '2 examples' },
    { value: '3', label: '3 examples' },
    { value: '4', label: '4 examples' },
    { value: '5', label: '5 examples' }
  ];

  return (
    <div className="settings">
      <h2>Setup & Configuration</h2>
      <p className="description">
        Configure API keys and Anki connection settings.
      </p>

      {/* Anki Connection Status */}
      <div className="settings-section">
        <h3>Anki Connection</h3>
        <div className="anki-status">
          <span className={`status-indicator ${ankiConnected ? 'connected' : 'disconnected'}`}>
            {ankiConnected ? '● Connected' : '● Disconnected'}
          </span>
          <Button
            onClick={checkAnkiConnection}
            variant="secondary"
            size="small"
            disabled={isLoadingAnki}
          >
            {isLoadingAnki ? 'Checking...' : 'Refresh'}
          </Button>
        </div>
        {!ankiConnected && (
          <p className="help-text error">
            Anki is not running or AnkiConnect addon is not installed.
            Please make sure Anki is running and install the AnkiConnect addon.
          </p>
        )}
      </div>

      {/* AI Provider */}
      <div className="settings-section">
        <h3>AI Provider</h3>
        <Select
          label="Provider"
          value={aiProvider}
          onChange={(e) => handleProviderChange(e.target.value)}
          options={providerOptions}
        />

        {isCustomProvider ? (
          <>
            <Input
              label="Base URL (OpenAI-compatible endpoint)"
              type="text"
              value={aiBaseUrl}
              onChange={(e) => setAiBaseUrl(e.target.value)}
              placeholder="https://your-endpoint/v1"
            />
            <Input
              label="Model"
              type="text"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder="model-name"
            />
          </>
        ) : (
          <Select
            label="Model"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            options={aiModelOptions}
          />
        )}

        <Input
          label="AI API Key"
          type="password"
          value={geminiApiKey}
          onChange={(e) => setGeminiApiKey(e.target.value)}
          placeholder="Enter the API key for the selected provider"
        />
        {aiProvider === 'proxyapi' && (
          <p className="help-text">
            Get your ProxyAPI key from{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.electronAPI.shell.openExternal('https://proxyapi.ru/cabinet/api');
              }}
            >
              ProxyAPI Cabinet
            </a>
          </p>
        )}
      </div>

      {/* Anki Settings */}
      <div className="settings-section">
        <h3>Anki Settings</h3>
        <Select
          label="Deck"
          value={selectedDeck}
          onChange={(e) => setSelectedDeck(e.target.value)}
          options={deckOptions}
          disabled={!ankiConnected}
        />
        <Select
          label="Note Type (Model)"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          options={modelOptions}
          disabled={!ankiConnected}
        />
        <Select
          label="Number of Example Sentences"
          value={exampleCount.toString()}
          onChange={(e) => setExampleCount(parseInt(e.target.value))}
          options={exampleCountOptions}
        />
      </div>

      {/* Field Mapping */}
      {selectedModel && availableFields.length > 0 && (
        <div className="settings-section">
          <h3>Field Mapping</h3>
          <p className="help-text">
            Map each Anki note field to the corresponding data source.
          </p>
          <FieldMapper
            fields={availableFields}
            mapping={fieldMapping}
            onChange={setFieldMapping}
          />
        </div>
      )}

      {/* Save Button */}
      <div className="save-section">
        <Button onClick={handleSave} disabled={isSaving} size="large">
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
        {saveMessage && (
          <span className={`save-message ${saveMessage.includes('Error') ? 'error' : 'success'}`}>
            {saveMessage}
          </span>
        )}
      </div>
    </div>
  );
};

export default Settings;
