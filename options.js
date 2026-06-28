// Загрузка и сохранение настроек расширения

document.addEventListener('DOMContentLoaded', () => {
  const providerSelect = document.getElementById('providerSelect');
  const geminiSettings = document.getElementById('geminiSettings');
  const customSettings = document.getElementById('customSettings');
  
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelect = document.getElementById('modelSelect');
  
  const customUrlInput = document.getElementById('customUrl');
  const customKeyInput = document.getElementById('customKey');
  const customModelInput = document.getElementById('customModel');
  
  const saveBtn = document.getElementById('saveBtn');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const statusAlert = document.getElementById('statusAlert');

  // Переключение видимости блоков настроек
  providerSelect.addEventListener('change', () => {
    toggleSettingsView(providerSelect.value);
  });

  function toggleSettingsView(provider) {
    if (provider === 'custom') {
      geminiSettings.style.display = 'none';
      customSettings.style.display = 'block';
    } else {
      geminiSettings.style.display = 'block';
      customSettings.style.display = 'none';
    }
  }

  // Загружаем сохраненные настройки
  chrome.storage.local.get([
    'apiProvider', 
    'geminiApiKey', 
    'geminiModel', 
    'customApiBaseUrl', 
    'customApiKey', 
    'customApiModel'
  ], (items) => {
    const provider = items.apiProvider || 'gemini';
    providerSelect.value = provider;
    toggleSettingsView(provider);

    if (items.geminiApiKey) apiKeyInput.value = items.geminiApiKey;
    if (items.geminiModel) modelSelect.value = items.geminiModel;
    
    customUrlInput.value = items.customApiBaseUrl || 'http://localhost:11434/v1';
    if (items.customApiKey) customKeyInput.value = items.customApiKey;
    customModelInput.value = items.customApiModel || 'llama3';
  });

  // Сохраняем настройки
  saveBtn.addEventListener('click', () => {
    const provider = providerSelect.value;
    const geminiApiKey = apiKeyInput.value.trim();
    const geminiModel = modelSelect.value;
    const customApiBaseUrl = customUrlInput.value.trim();
    const customApiKey = customKeyInput.value.trim();
    const customApiModel = customModelInput.value.trim();

    chrome.storage.local.set({
      apiProvider: provider,
      geminiApiKey,
      geminiModel,
      customApiBaseUrl,
      customApiKey,
      customApiModel
    }, () => {
      showStatus("Настройки сохранены!", "alert-success");
    });
  });

  // Очистка кэша проверенных видео
  clearCacheBtn.addEventListener('click', () => {
    if (confirm("Вы действительно хотите удалить всю историю кэша проверенных видео? При повторном просмотре этих видео потребуется повторный анализ через ИИ.")) {
      chrome.storage.local.remove('savedAnalyses', () => {
        showStatus("Кэш успешно очищен!", "alert-success");
      });
    }
  });

  function showStatus(message, className) {
    statusAlert.textContent = message;
    statusAlert.className = `alert ${className}`;
    statusAlert.style.display = 'block';

    setTimeout(() => {
      statusAlert.style.display = 'none';
    }, 3000);
  }
});
