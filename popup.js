// Логика работы всплывающего окна расширения

// Локализация статического интерфейса
const locales = {
  ru: {
    open_youtube_title: "Откройте видео на YouTube",
    open_youtube_desc: "Чтобы начать проверку, перейдите на страницу просмотра видео YouTube и откройте расширение.",
    btn_analyze: "Анализировать видео",
    loading_transcript: "Считываем аудиодорожку...",
    loading_sub: "Это может занять до минуты в зависимости от длины видео.",
    verdict_label: "Вердикт ИИ:",
    citations_title: "Проверенные цитаты",
    btn_check_text: "Проверить текст",
    no_key_alert: "Пожалуйста, установите API-ключ Gemini в настройках.",
    status_safe: "Достоверно",
    status_warning: "Есть вопросы",
    status_unreliable: "Недостоверно",
    accuracy_label: "Анализ точности:",
    original_label: "Оригинальный текст:",
    spoken_label: "Сказано в видео:",
    verify_link: "Проверить источник ↗",
    no_citations: "Цитаты из исламских источников не обнаружены.",
    analyzing_ai: "ИИ анализирует контент...",
    settings_saved: "Настройки сохранены!",
    btn_configure: "Настроить",
    status_label_safe: "Безопасно",
    status_label_warning: "Предупреждение",
    status_label_unreliable: "Ненадёжно",
    rating_sahih: "Сахих (Достоверный)",
    rating_hasan: "Хасан (Хороший)",
    rating_da_if: "Даиф (Слабый)",
    rating_maudu_: "Мауду (Вымышленный)",
    rating_unknown: "Неизвестно",
    speaker_label: "Анализ личности:",
    class_salafi: "Саляфит",
    class_ikhwan: "Ихван",
    class_kharijite: "Хариджит",
    class_doubtful: "Сомнительная личность",
    class_misguided: "Заблудший",
    class_unknown: "Неизвестно"
  },
  en: {
    open_youtube_title: "Open a YouTube video",
    open_youtube_desc: "To start fact-checking, go to a YouTube video page and open the extension.",
    btn_analyze: "Analyze Video",
    loading_transcript: "Extracting speech transcript...",
    loading_sub: "This may take up to a minute depending on video length.",
    verdict_label: "AI Verdict:",
    citations_title: "Verified Citations",
    btn_check_text: "Check Text",
    no_key_alert: "Please set your Gemini API Key in the settings page.",
    status_safe: "Safe",
    status_warning: "Warning",
    status_unreliable: "Unreliable",
    accuracy_label: "Accuracy Analysis:",
    original_label: "Original Text:",
    spoken_label: "Spoken in Video:",
    verify_link: "Verify Source ↗",
    no_citations: "No Islamic citations detected.",
    analyzing_ai: "AI is analyzing content...",
    settings_saved: "Settings saved!",
    btn_configure: "Configure",
    status_label_safe: "Trusted",
    status_label_warning: "Warning",
    status_label_unreliable: "Unreliable",
    rating_sahih: "Sahih (Authentic)",
    rating_hasan: "Hasan (Good)",
    rating_da_if: "Da'if (Weak)",
    rating_maudu_: "Maudu' (Fabricated)",
    rating_unknown: "Unknown",
    speaker_label: "Preacher Analysis:",
    class_salafi: "Salafi",
    class_ikhwan: "Ikhwani",
    class_kharijite: "Kharijite",
    class_doubtful: "Doubtful Personality",
    class_misguided: "Misguided",
    class_unknown: "Unknown"
  },
  ar: {
    open_youtube_title: "افتح فيديو يوتيوب",
    open_youtube_desc: "لبدء التحقق، انتقل إلى صفحة فيديو يوتيوب وافتح الامتداد.",
    btn_analyze: "تحليل الفيديو",
    loading_transcript: "جاري استخراج النص الصوتي...",
    loading_sub: "قد يستغرق ذلك ما يصل إلى دقيقة بناءً على طول الفيديو.",
    verdict_label: "حكم الذкاء الاصطناعي:",
    citations_title: "الاقتباسات التي تم التحقق منها",
    btn_check_text: "تحقق من النص",
    no_key_alert: "يرجى تعيين مفتاح Gemini API في الإعدادات.",
    status_safe: "موثوق",
    status_warning: "تنبيه",
    status_unreliable: "غير موثوق",
    accuracy_label: "تحليل الدقة:",
    original_label: "النص الأصلي:",
    spoken_label: "قيل في الفيديو:",
    verify_link: "التحقق من المصدر ↗",
    no_citations: "لم يتم الكشف عن اقتباسات إسلامية.",
    analyzing_ai: "الذكاء الاصطناعي يقوم بالتحليل...",
    settings_saved: "تم حفظ الإعدادات!",
    btn_configure: "تهيئة",
    status_label_safe: "آمن",
    status_label_warning: "تحذير",
    status_label_unreliable: "غير موثوق",
    rating_sahih: "صحيح",
    rating_hasan: "حسن",
    rating_da_if: "ضعيف",
    rating_maudu_: "موضوع",
    rating_unknown: "غير معروف",
    speaker_label: "تحليل الشخصية:",
    class_salafi: "سلفي",
    class_ikhwan: "إخواني",
    class_kharijite: "خارجي",
    class_doubtful: "شخصية مشبوهة",
    class_misguided: "ضال",
    class_unknown: "غير معروف"
  }
};

let currentLang = 'ru';
let activeVideoId = null;
let activeVideoDetails = null; // Хранит метаданные и субтитры видео
let currentReportData = null; // Хранит результат анализа ИИ

document.addEventListener('DOMContentLoaded', () => {
  initLanguage();
  initTabs();
  checkSettings();
  detectYouTubeVideo();

  // Открытие страницы настроек
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('alertActionBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Запуск анализа YouTube-видео
  document.getElementById('startAnalysisBtn').addEventListener('click', () => {
    if (!activeVideoId) return;
    startVideoAnalysis(activeVideoId);
  });

  // Запуск ручного анализа текста
  document.getElementById('startTextAnalysisBtn').addEventListener('click', () => {
    const text = document.getElementById('manualTextInput').value.trim();
    if (!text) return;
    startTextAnalysis(text);
  });
});

// Настройка мультиязычности
function initLanguage() {
  const langSelector = document.getElementById('langSelector');
  
  // Читаем ранее выбранный язык интерфейса
  chrome.storage.local.get(['appLanguage'], (result) => {
    if (result.appLanguage) {
      currentLang = result.appLanguage;
      updateLangSelectorUI();
    }
    translateUI();
  });

  langSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-btn');
    if (!btn) return;
    
    currentLang = btn.dataset.lang;
    chrome.storage.local.set({ appLanguage: currentLang });
    
    updateLangSelectorUI();
    translateUI();
    
    // Если отчет уже загружен, перерисовываем его на новом языке
    if (currentReportData) {
      renderReport(currentReportData);
    }
  });
}

function updateLangSelectorUI() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.dataset.lang === currentLang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function translateUI() {
  const t = locales[currentLang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key]) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = t[key];
      } else {
        el.textContent = t[key];
      }
    }
  });

  // Локализация динамических лейблов, если они отображаются в данный момент
  if (currentReportData) {
    updateVerdictBadgeText();
  }
}

// Переключение вкладок
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.getElementById(tabId).classList.add('active');
    });
  });
}

// Проверка настроек провайдера ИИ
function checkSettings() {
  chrome.storage.local.get([
    'apiProvider', 
    'geminiApiKey', 
    'customApiBaseUrl', 
    'customApiModel'
  ], (result) => {
    const alertBanner = document.getElementById('alertBanner');
    const alertMsg = document.getElementById('alertMsg');
    
    const provider = result.apiProvider || 'gemini';
    let isValid = false;
    
    if (provider === 'gemini') {
      isValid = !!result.geminiApiKey;
    } else {
      isValid = !!result.customApiBaseUrl && !!result.customApiModel;
    }
    
    if (!isValid) {
      alertMsg.textContent = locales[currentLang].no_key_alert;
      document.getElementById('alertActionBtn').textContent = locales[currentLang].btn_configure;
      alertBanner.style.display = 'flex';
      
      // Блокируем кнопки
      document.getElementById('startAnalysisBtn').disabled = true;
      document.getElementById('startTextAnalysisBtn').disabled = true;
    } else {
      alertBanner.style.display = 'none';
      document.getElementById('startAnalysisBtn').disabled = false;
      document.getElementById('startTextAnalysisBtn').disabled = false;
    }
  });
}

// Определение текущего видео на вкладке
function detectYouTubeVideo() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.url || !activeTab.url.includes("youtube.com/watch")) {
      showView("noVideoView");
      return;
    }

    // Запрашиваем информацию у content.js
    chrome.tabs.sendMessage(activeTab.id, { action: "getVideoDetails" }, (response) => {
      let finalDetails = {
        success: true,
        title: activeTab.title.replace(" - YouTube", ""),
        channel: "YouTube Video",
        url: activeTab.url,
        videoId: new URLSearchParams(new URL(activeTab.url).search).get('v'),
        description: "",
        captionTracks: null
      };

      if (!chrome.runtime.lastError && response && response.success) {
        finalDetails = { ...finalDetails, ...response };
      }

      activeVideoId = finalDetails.videoId;
      activeVideoDetails = finalDetails;

      document.getElementById('videoChannel').textContent = finalDetails.channel;
      document.getElementById('videoTitle').textContent = finalDetails.title;
      showView("videoReadyView");

      // Пытаемся безопасно получить ytInitialPlayerResponse через chrome.scripting
      try {
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            let playerResponse = null;
            
            // 1. Пробуем получить через официальный API плеера YouTube (надежно при SPA переходах)
            try {
              const player = document.getElementById("movie_player");
              if (player && typeof player.getPlayerResponse === "function") {
                playerResponse = player.getPlayerResponse();
              }
            } catch (e) {}
            
            // 2. Резервные варианты из глобальных переменных
            if (!playerResponse) {
              if (typeof ytInitialPlayerResponse !== 'undefined' && ytInitialPlayerResponse) {
                playerResponse = ytInitialPlayerResponse;
              } else if (typeof ytplayer !== 'undefined' && ytplayer.config && ytplayer.config.args && ytplayer.config.args.raw_player_response) {
                try {
                  playerResponse = JSON.parse(ytplayer.config.args.raw_player_response);
                } catch (e) {}
              }
            }
            
            if (!playerResponse) {
              const scripts = document.getElementsByTagName('script');
              for (const script of scripts) {
                const text = script.textContent;
                if (text && text.includes('ytInitialPlayerResponse')) {
                  const match = text.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
                  if (match) {
                    try {
                      playerResponse = JSON.parse(match[1]);
                      break;
                    } catch (e) {}
                  }
                }
              }
            }

            if (!playerResponse) return null;

            return {
              title: playerResponse.videoDetails?.title || "",
              author: playerResponse.videoDetails?.author || "",
              shortDescription: playerResponse.videoDetails?.shortDescription || "",
              captionTracks: playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks || null
            };
          },
          world: 'MAIN'
        }, (results) => {
          if (chrome.runtime.lastError) {
            console.warn("Scripting failed:", chrome.runtime.lastError);
            checkCache(activeVideoDetails.videoId);
            return;
          }
          if (results && results[0] && results[0].result) {
            const playerResponse = results[0].result;
            activeVideoDetails.captionTracks = playerResponse.captionTracks || null;
            if (playerResponse.shortDescription) {
              activeVideoDetails.description = playerResponse.shortDescription;
            }
            if (playerResponse.title) {
              activeVideoDetails.title = playerResponse.title;
              document.getElementById('videoTitle').textContent = playerResponse.title;
            }
            if (playerResponse.author) {
              activeVideoDetails.channel = playerResponse.author;
              document.getElementById('videoChannel').textContent = playerResponse.author;
            }
          }
          checkCache(activeVideoDetails.videoId);
        });
      } catch (err) {
        console.warn("Scripting execution exception, using fallback details", err);
        checkCache(activeVideoDetails.videoId);
      }
    });
  });
}

// Проверка наличия данных в кэше
function checkCache(videoId) {
  chrome.runtime.sendMessage({ action: "getCachedData", videoId }, (response) => {
    if (response && response.success && response.data) {
      currentReportData = response.data;
      renderReport(response.data);
      showView("resultsView");
    }
  });
}

// Переключение отображаемых блоков
function showView(viewId) {
  const views = ["noVideoView", "videoReadyView", "loadingView", "resultsView"];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (id === viewId) {
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  });
}

// Запуск анализа видео через background script
function startVideoAnalysis(videoId) {
  showView("loadingView");
  
  // Устанавливаем статус-текст
  document.getElementById('loadingText').textContent = locales[currentLang].loading_transcript;
  
  // Через 15 секунд переключаем статус на анализ ИИ для лучшего UX
  const statusTimer = setTimeout(() => {
    document.getElementById('loadingText').textContent = locales[currentLang].analyzing_ai;
  }, 15000);

  chrome.runtime.sendMessage({ 
    action: "analyzeVideo", 
    videoId, 
    videoDetails: activeVideoDetails 
  }, (response) => {
    clearTimeout(statusTimer);
    if (response && response.success) {
      currentReportData = response.data;
      renderReport(response.data);
      showView("resultsView");
    } else {
      showError(response ? response.error : "Неизвестная ошибка анализа");
      showView("videoReadyView");
    }
  });
}

// Запуск ручного анализа текста
function startTextAnalysis(text) {
  // Переключаемся на вкладку видео для отображения лоадера
  document.getElementById('tabVideoBtn').click();
  showView("loadingView");
  document.getElementById('loadingText').textContent = locales[currentLang].analyzing_ai;

  chrome.runtime.sendMessage({ action: "analyzeText", text }, (response) => {
    if (response && response.success) {
      currentReportData = response.data;
      renderReport(response.data);
      showView("resultsView");
    } else {
      showError(response ? response.error : "Неизвестная ошибка анализа");
      showView("videoReadyView");
    }
  });
}

// Отображение ошибки
function showError(message) {
  const alertBanner = document.getElementById('alertBanner');
  const alertMsg = document.getElementById('alertMsg');
  alertMsg.textContent = message;
  document.getElementById('alertActionBtn').textContent = locales[currentLang].btn_configure;
  alertBanner.style.display = 'flex';
}

// Отрисовка отчета
function renderReport(report) {
  const t = locales[currentLang];
  const verdictCard = document.getElementById('verdictCard');
  const verdictBadge = document.getElementById('verdictBadge');
  const verdictText = document.getElementById('verdictText');
  
  // Сбрасываем классы вердикта
  verdictCard.className = "verdict-card";
  verdictBadge.className = "badge";
  
  const rating = report.verdict.rating; // Safe | Warning | Unreliable
  if (rating === "Safe") {
    verdictCard.classList.add("safe");
    verdictBadge.classList.add("safe");
  } else if (rating === "Warning") {
    verdictCard.classList.add("warning");
    verdictBadge.classList.add("warning");
  } else {
    verdictCard.classList.add("unreliable");
    verdictBadge.classList.add("unreliable");
  }
  
  updateVerdictBadgeText();

  // Устанавливаем текст вывода ИИ в зависимости от языка
  const summaryText = report.verdict.summary[currentLang] || report.verdict.summary['en'] || "";
  verdictText.textContent = summaryText;

  // Отрисовка карточки личности
  const speakerCard = document.getElementById('speakerCard');
  const speakerName = document.getElementById('speakerName');
  const speakerBadge = document.getElementById('speakerBadge');
  const speakerText = document.getElementById('speakerText');

  if (report.speaker) {
    const sp = report.speaker;
    speakerName.textContent = sp.name || "Неизвестный спикер";
    
    speakerCard.className = "speaker-card";
    speakerBadge.className = "badge";
    
    const classification = sp.classification || "unknown";
    speakerCard.classList.add(classification);
    
    let badgeClass = "unknown";
    let badgeKey = "class_unknown";
    if (classification === "salafi") {
      badgeClass = "safe";
      badgeKey = "class_salafi";
    } else if (classification === "ikhwan") {
      badgeClass = "warning";
      badgeKey = "class_ikhwan";
    } else if (classification === "kharijite") {
      badgeClass = "unreliable";
      badgeKey = "class_kharijite";
    } else if (classification === "doubtful") {
      badgeClass = "warning";
      badgeKey = "class_doubtful";
    } else if (classification === "misguided") {
      badgeClass = "unreliable";
      badgeKey = "class_misguided";
    }
    
    speakerBadge.classList.add(badgeClass);
    speakerBadge.textContent = t[badgeKey] || classification;

    speakerText.textContent = sp.details[currentLang] || sp.details['en'] || "";
    speakerCard.style.display = "block";
  } else {
    speakerCard.style.display = "none";
  }

  // Отрисовка списка цитат
  const citationsList = document.getElementById('citationsList');
  citationsList.innerHTML = "";
  
  const citations = report.citations || [];
  document.getElementById('citationCount').textContent = citations.length;

  if (citations.length === 0) {
    citationsList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">${t.no_citations}</div>`;
    return;
  }

  citations.forEach((cit, index) => {
    const card = document.createElement('div');
    card.className = "citation-card";
    
    // Определяем класс для бейджа достоверности
    let authClass = "unknown";
    let authKey = "rating_unknown";
    const auth = cit.authenticity;
    if (auth === "Sahih") {
      authClass = "sahih";
      authKey = "rating_sahih";
    } else if (auth === "Hasan") {
      authClass = "hasan";
      authKey = "rating_hasan";
    } else if (auth === "Da'if") {
      authClass = "da_if";
      authKey = "rating_da_if";
    } else if (auth === "Maudu'") {
      authClass = "maudu_";
      authKey = "rating_maudu_";
    }
    
    const authLabel = t[authKey] || auth;

    // Текстовые переводы для карточки цитаты
    const spoken = cit.spokenText;
    const accuracy = cit.accuracyCheck[currentLang] || cit.accuracyCheck['en'] || "";
    const originalTextVal = cit.originalText[currentLang] || cit.originalText['en'] || "";
    const arabicVal = cit.originalText['ar'] || "";

    card.innerHTML = `
      <div class="citation-card-header">
        <div class="citation-ref">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color: var(--primary-emerald);"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <span>${cit.reference}</span>
        </div>
        <span class="citation-badge ${authClass}">${authLabel}</span>
      </div>
      <div class="citation-card-body">
        <div class="citation-detail-block">
          <span class="detail-label">${t.spoken_label}</span>
          <p class="detail-val">"${spoken}"</p>
        </div>
        
        ${arabicVal ? `
        <div class="citation-detail-block">
          <span class="detail-label">العربية (Арабский)</span>
          <p class="detail-val arabic">${arabicVal}</p>
        </div>
        ` : ''}

        ${originalTextVal ? `
        <div class="citation-detail-block">
          <span class="detail-label">${t.original_label}</span>
          <p class="detail-val">${originalTextVal}</p>
        </div>
        ` : ''}

        <div class="citation-detail-block">
          <span class="detail-label">${t.accuracy_label}</span>
          <p class="detail-val" style="color: ${rating === 'Unreliable' ? 'var(--status-danger)' : 'var(--text-main)'};">${accuracy}</p>
        </div>
        
        ${cit.verificationLink ? `
          <a href="${cit.verificationLink}" target="_blank" class="btn-verify">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
            <span>${t.verify_link}</span>
          </a>
        ` : ''}
      </div>
    `;

    // Логика разворачивания карточки
    card.querySelector('.citation-card-header').addEventListener('click', () => {
      card.classList.toggle('expanded');
    });

    citationsList.appendChild(card);
  });
}

function updateVerdictBadgeText() {
  const t = locales[currentLang];
  const verdictBadge = document.getElementById('verdictBadge');
  if (!currentReportData || !verdictBadge) return;
  
  const rating = currentReportData.verdict.rating;
  if (rating === "Safe") {
    verdictBadge.textContent = t.status_label_safe;
  } else if (rating === "Warning") {
    verdictBadge.textContent = t.status_label_warning;
  } else {
    verdictBadge.textContent = t.status_label_unreliable;
  }
}
