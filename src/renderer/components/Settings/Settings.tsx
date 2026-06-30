import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import { AI_PROVIDERS } from '../../../shared/types';
import { useT } from '../../prefs/PreferencesProvider';
import './Settings.css';

const Settings: React.FC = () => {
  const t = useT();
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      await saveSettings();
      setSaveMessage(t('setup.savedSuccess'));
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

  const exampleCountOptions = [1, 2, 3].map((n) => ({
    value: String(n),
    label: t(`setup.example${n}` as any)
  }));

  const dailyGoalOptions = [10, 15, 20].map((n) => ({
    value: n.toString(),
    label: t('setup.reviewsPerDay').replace('{n}', String(n))
  }));

  return (
    <div className="settings">
      <h2>{t('setup.title')}</h2>
      <p className="description">{t('setup.description')}</p>

      <div className="settings-section">
        <h3>{t('setup.aiProvider')}</h3>

        {__IS_WEB__ && (
          <p className="help-text settings-free-info">{t('setup.freeInfo')}</p>
        )}

        {!__IS_WEB__ && (
          <Select
            label={t('setup.provider')}
            value={aiProvider}
            onChange={(v) => handleProviderChange(v)}
            options={providerOptions}
          />
        )}

        {/* Модель доступна на обеих платформах */}
        {isCustomProvider && !__IS_WEB__ ? (
          <>
            <Input
              label={t('setup.baseUrl')}
              type="text"
              value={aiBaseUrl}
              onChange={(e) => setAiBaseUrl(e.target.value)}
              placeholder="https://your-endpoint/v1"
            />
            <Input
              label={t('setup.model')}
              type="text"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder={t('setup.modelPlaceholder')}
            />
          </>
        ) : (
          <Select
            label={t('setup.model')}
            value={aiModel}
            onChange={(v) => setAiModel(v)}
            options={aiModelOptions}
          />
        )}

        {!__IS_WEB__ ? (
          <>
            <Input
              label={t('setup.apiKey')}
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder={t('setup.apiKeyPlaceholder')}
            />
            {aiProvider === 'proxyapi' && (
              <p className="help-text">
                {t('setup.proxyApiHint')}{' '}
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
          </>
        ) : (
          <div className="settings-advanced">
            <button
              type="button"
              className="advanced-toggle"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? '▾' : '▸'} {t('setup.advanced')}
            </button>
            {showAdvanced && (
              <>
                <Input
                  label={t('setup.apiKey')}
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder={t('setup.apiKeyPlaceholder')}
                />
                <p className="help-text">{t('setup.ownKeyHint')}</p>
              </>
            )}
          </div>
        )}

        <Select
          label={t('setup.exampleCount')}
          value={exampleCount.toString()}
          onChange={(v) => setExampleCount(parseInt(v))}
          options={exampleCountOptions}
        />
      </div>

      <div className="settings-section">
        <h3>{t('setup.studyGoal')}</h3>
        <Select
          label={t('setup.dailyGoal')}
          value={dailyGoal.toString()}
          onChange={(v) => setDailyGoal(parseInt(v))}
          options={dailyGoalOptions}
        />
        <p className="help-text">
          {t('setup.reviewsHint')}
        </p>
      </div>

      {window.electronAPI.backup && (
        <div className="settings-section settings-backup">
          <h3>{t('setup.backup')}</h3>
          <div className="backup-actions">
            <Button onClick={() => window.electronAPI.backup!.export()}>
              {t('setup.exportDb')}
            </Button>
            <label className="btn btn-secondary btn-medium" style={{ cursor: 'pointer' }}>
              {t('setup.importDb')}
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
            {t('setup.backupHint')}
          </p>
        </div>
      )}

      <div className="save-section">
        <Button onClick={handleSave} disabled={isSaving} size="large">
          {isSaving ? t('setup.saving') : t('setup.saveSettings')}
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
