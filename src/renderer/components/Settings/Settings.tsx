import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import { AI_PROVIDERS } from '../../../shared/types';
import './Settings.css';

const Settings: React.FC = () => {
  const {
    geminiApiKey,
    aiProvider,
    aiModel,
    aiBaseUrl,
    exampleCount,
    dailyGoal,
    setGeminiApiKey,
    setAiProvider,
    setAiModel,
    setAiBaseUrl,
    setExampleCount,
    setDailyGoal,
    loadSettings,
    saveSettings
  } = useStore();

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

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

  const exampleCountOptions = [
    { value: '1', label: '1 example' },
    { value: '2', label: '2 examples' },
    { value: '3', label: '3 examples' },
    { value: '4', label: '4 examples' },
    { value: '5', label: '5 examples' }
  ];

  const dailyGoalOptions = [10, 15, 20, 30, 50, 75, 100].map((n) => ({
    value: n.toString(),
    label: `${n} reviews per day`
  }));

  return (
    <div className="settings">
      <h2>Setup & Configuration</h2>
      <p className="description">Configure AI provider and generation.</p>

      <div className="settings-section">
        <h3>AI Provider</h3>
        <Select
          label="Provider"
          value={aiProvider}
          onChange={(v) => handleProviderChange(v)}
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
            onChange={(v) => setAiModel(v)}
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

        <Select
          label="Number of Example Sentences"
          value={exampleCount.toString()}
          onChange={(v) => setExampleCount(parseInt(v))}
          options={exampleCountOptions}
        />
      </div>

      <div className="settings-section">
        <h3>Study Goal</h3>
        <Select
          label="Daily goal"
          value={dailyGoal.toString()}
          onChange={(v) => setDailyGoal(parseInt(v))}
          options={dailyGoalOptions}
        />
        <p className="help-text">
          How many reviews per day you need to close the progress ring on the
          Decks screen.
        </p>
      </div>

      {window.electronAPI.backup && (
        <div className="settings-section settings-backup">
          <h3>Backup</h3>
          <div className="backup-actions">
            <Button onClick={() => window.electronAPI.backup!.export()}>
              Export database
            </Button>
            <label className="btn btn-secondary btn-medium" style={{ cursor: 'pointer' }}>
              Import database
              <input
                type="file"
                accept=".qard,application/octet-stream"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  await window.electronAPI.backup!.import(f);
                  location.reload();
                }}
              />
            </label>
          </div>
          <p className="help-text">
            Export saves the database to a .qard file. Import replaces the current
            database with the uploaded file and reloads the app.
          </p>
        </div>
      )}

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
