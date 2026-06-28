// Фоновый скрипт (Service Worker) для InTruth Islamic

// Кэш для результатов анализа (в памяти и в локальном хранилище)
const analysisCache = {};

// Слушатель сообщений от popup или options
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeVideo") {
    const { videoId, videoDetails } = request;
    if (analysisCache[videoId]) {
      sendResponse({ success: true, data: analysisCache[videoId] });
      return true;
    }

    // Запускаем асинхронный процесс анализа
    runVideoAnalysis(videoId, videoDetails)
      .then(result => {
        analysisCache[videoId] = result;
        // Сохраняем в chrome storage для долгосрочного кэша (лимитируем размер)
        chrome.storage.local.get(['savedAnalyses'], (store) => {
          const saved = store.savedAnalyses || {};
          saved[videoId] = { ...result, timestamp: Date.now() };
          
          // Удаляем старые записи из кэша, если их > 50
          const keys = Object.keys(saved);
          if (keys.length > 50) {
            keys.sort((a, b) => saved[a].timestamp - saved[b].timestamp);
            delete saved[keys[0]];
          }
          
          chrome.storage.local.set({ savedAnalyses: saved });
        });
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });

    return true; // Асинхронный ответ
  }

  if (request.action === "analyzeText") {
    const { text } = request;
    runTextAnalysis(text)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === "getCachedData") {
    const { videoId } = request;
    if (analysisCache[videoId]) {
      sendResponse({ success: true, data: analysisCache[videoId] });
    } else {
      chrome.storage.local.get(['savedAnalyses'], (store) => {
        const saved = store.savedAnalyses || {};
        if (saved[videoId]) {
          analysisCache[videoId] = saved[videoId];
          sendResponse({ success: true, data: saved[videoId] });
        } else {
          sendResponse({ success: false });
        }
      });
    }
    return true;
  }
});

// Универсальный парсер субтитров YouTube (поддерживает форматы XML и JSON)
function parseTranscript(text) {
  text = text.trim();
  
  // Если ответ в формате JSON (json3)
  if (text.startsWith('{')) {
    try {
      const data = JSON.parse(text);
      if (data.events) {
        return data.events
          .map(e => {
            const t = e.segs ? e.segs.map(s => s.utf8).join('') : '';
            return {
              text: t.replace(/\n/g, ' ').trim(),
              start: e.tStartMs / 1000,
              dur: (e.dDurationMs || 0) / 1000
            };
          })
          .filter(item => item.text);
      }
    } catch (e) {
      console.error("Ошибка парсинга JSON субтитров:", e);
    }
  }

  // Если ответ в формате XML (по умолчанию)
  const regex = /<text[^>]*start="([\d.]+)"(?:[^>]*dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  let match;
  const result = [];
  while ((match = regex.exec(text)) !== null) {
    let t = match[3]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/\n/g, ' ')
      .trim();
    
    const start = parseFloat(match[1]);
    const dur = match[2] ? parseFloat(match[2]) : 0;
    
    if (t) {
      result.push({ text: t, start, dur });
    }
  }
  return result;
}

// Загрузка субтитров видео (резервный фоновый скрейпинг)
async function getYouTubeTranscript(videoId) {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) throw new Error("Не удалось загрузить страницу YouTube");
    const html = await response.text();
    
    const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!match) throw new Error("Данные видео не найдены в фоновом режиме.");
    
    const playerResponse = JSON.parse(match[1]);
    const captions = playerResponse.captions?.playerCaptionsTracklistRenderer;
    if (!captions || !captions.captionTracks || captions.captionTracks.length === 0) {
      throw new Error("Субтитры недоступны для этого видео.");
    }
    
    const tracks = captions.captionTracks;
    let selectedTrack = tracks.find(t => t.languageCode === 'ru') ||
                        tracks.find(t => t.languageCode === 'en') ||
                        tracks.find(t => t.languageCode === 'ar') ||
                        tracks[0];
    
    if (!selectedTrack) throw new Error("Не найден трек субтитров");
    
    const transcriptUrl = selectedTrack.baseUrl;
    const transcriptResponse = await fetch(transcriptUrl);
    if (!transcriptResponse.ok) throw new Error("Не удалось загрузить текст субтитров");
    
    const textData = await transcriptResponse.text();
    const parsed = parseTranscript(textData);
    
    if (parsed.length === 0) throw new Error("Субтитры пусты");
    
    const fullText = parsed.map(p => p.text).join(' ');
    return { fullText, lang: selectedTrack.languageCode, segments: parsed };
  } catch (e) {
    console.error("Ошибка фоновой загрузки субтитров:", e);
    throw e;
  }
}

// База данных принудительного переопределения личностей (Speaker Overrides)
const SPEAKER_OVERRIDES = [
  {
    keywords: ["ульван", "ulwan", "al-ulwan", "аль-ульван"],
    name: "Suleiman al-Ulwan (Сулейман аль-Ульван)",
    classification: "kharijite",
    details: {
      ru: "Сулейман аль-Ульван классифицируется учеными Ахлю Сунна (такими как шейх Салих аль-Фаузан, шейх Салих аль-Люхайдан) как человек, имеющий хариджитские/такфиристские отклонения. Он был предостережен за призыв к выходу против правителей и поддержку радикальных идей.",
      en: "Suleiman al-Ulwan is classified by the scholars of Ahlus Sunnah (such as Sheikh Salih al-Fawzan, Sheikh Salih al-Luhaydan) as having Kharijite/Takfiri deviations. He was warned against for calling for rebellion against rulers and supporting radical views.",
      ar: "سليمان العلوان مصنف عند علماء أهل السنة والجмаعة بوجود انحرافات خارجية وتكفيرية لديه."
    }
  },
  {
    keywords: ["тарифи", "tarefe", "al-tarefe", "al-tarifi", "ат-тарифи"],
    name: "Abdul Aziz al-Tarefe (Абдулазиз ат-Тарифи)",
    classification: "ikhwan",
    details: {
      ru: "Абдулазиз ат-Тарифи относится к числу проповедников, склоняющихся к методологии Ихван аль-Муслимин и Кутбизма. Он был предостережен признанными учеными Ахлю Сунна за свои ошибочные взгляды в вопросах правителя и манхаджа.",
      en: "Abdul Aziz al-Tarefe is among the preachers leaning towards the methodology of the Muslim Brotherhood (Ikhwan) and Qutbism. He has been warned against by recognized scholars of Ahlus Sunnah for his incorrect views on rulers and methodology.",
      ar: "عبد العزيز الطريفي من الدعاة الذين يميلون إلى منهج الإخوان المسلمين والقطبية."
    }
  },
  {
    keywords: ["арифи", "arefe", "al-arefe", "al-arifi", "аль-арифи"],
    name: "Muhammad al-Arefe (Мухаммад аль-Арифи)",
    classification: "ikhwan",
    details: {
      ru: "Мухаммад аль-Арифи — известный проповедник, принадлежащий к течению Ихван аль-Муслимин. Имеет множество предостережений от ученых Ахлю Сунна за партийность (хизбийя) и разжигание смут.",
      en: "Muhammad al-Arefe is a well-known preacher associated with the Muslim Brotherhood (Ikhwan). He has received numerous warnings from the scholars of Ahlus Sunnah for partisan behavior (hizbiyyah) and inciting tribulations.",
      ar: "محمد العريفي داعية معروف ينتمي إلى جماعة الإخوان المسلمين."
    }
  },
  {
    keywords: ["абдуллах аль-фаузан", "abdullah al-fawzan", "абдуллах фаузан"],
    name: "Abdullah al-Fawzan (Абдуллах аль-Фаузан)",
    classification: "ikhwan",
    details: {
      ru: "Абдуллах аль-Фаузан (не путать с шейхом Салихом аль-Фаузаном) относится к проповедникам, поддерживающим идеи Ихван аль-Муслимин, и имеет методологические ошибки, о которых предостерегали ученые.",
      en: "Abdullah al-Fawzan (not to be confused with Sheikh Salih al-Fawzan) is associated with the ideas of the Muslim Brotherhood (Ikhwan) and has methodological deviations warned against by scholars.",
      ar: "عبد الله الفوزان (ليس الشيخ صالح الفوزان) مصنف بوجود أخطاء منهجية وميول إخوانية."
    }
  },
  {
    keywords: ["раби", "rabi", "мадхали", "madkhali", "аль-мадхали", "раби'"],
    name: "Sheikh Rabi' al-Madkhali (Шейх Раби аль-Мадхали)",
    classification: "salafi",
    details: {
      ru: "Шейх Раби аль-Madkhali — выдающийся ученый Ахлю Сунна (Саляфийя), известный своим вкладом в защиту саляфитского манхаджа и опровержение заблудших течений (ихванов, хариджитов, кутбитов). Его рекомендовали шейх Ибн Баз, шейх аль-Альбани, шейх аль-Люхайдан и шейх аль-Фаузан.",
      en: "Sheikh Rabi' al-Madkhali is a prominent scholar of Ahlus Sunnah (Salafiyyah), widely known for defending the Salafi manhaj and refuting misguided groups (Ikhwan, Kharijites, Qutbis). He was recommended by Sheikh Ibn Baz, Sheikh al-Albanee, and Sheikh al-Fawzan.",
      ar: "الشيخ ربيع بن هادي المدخلي من أبرز علماء أهل السنة والجماعة الداعين إلى المنهج السلفي."
    }
  },
  {
    keywords: ["салих аль-фаузан", "салих фаузан", "saleh al-fawzan", "salih al-fawzan", "аль-фаузан"],
    name: "Sheikh Saleh al-Fawzan (Шейх Салих аль-Фаузан)",
    classification: "salafi",
    details: {
      ru: "Шейх Салих аль-Фаузан — один из авторитетнейших современных ученых Ахлю Сунна (Саляфийя), член Комитета больших ученых Саудовской Аравии. Известен своей строгой приверженностью саляфии и борьбой с заблуждениями.",
      en: "Sheikh Saleh al-Fawzan is one of the most authoritative contemporary scholars of Ahlus Sunnah (Salafiyyah), member of the Council of Senior Scholars of Saudi Arabia. Known for his strict adherence to Salafiyyah.",
      ar: "الشيخ صالح بن فوزان الفوزان عضو هيئة كبار العلماء ومن كبار علماء أهل السنة."
    }
  },
  {
    keywords: ["люхайдан", "luhaydan", "al-luhaydan", "аль-люхайдан"],
    name: "Sheikh Salih al-Luhaydan (Шейх Салих аль-Люхайдан)",
    classification: "salafi",
    details: {
      ru: "Шейх Салих аль-Люхайдан — выдающийся ученый Ахлю Сунна (Саляфийя), бывший глава Высшего судебного совета Саудовской Аравии. Был известен твердостью в саляфитском манхадже и защитой Сунны.",
      en: "Sheikh Salih al-Luhaydan was a prominent scholar of Ahlus Sunnah (Salafiyyah), former head of the Higher Judicial Council of Saudi Arabia. Known for his firmness in the Salafi manhaj.",
      ar: "الشيخ صالح اللحيدان رئيس مجلس القضاء الأعلى السابق ومن كبار علماء أهل السنة."
    }
  },
  {
    keywords: ["синди", "sindi", "al-sindi", "салих синди"],
    name: "Sheikh Salih Sindi (Шейх Салих Синди)",
    classification: "salafi",
    details: {
      ru: "Шейх Салих Синди — известный современный ученый и преподаватель в Исламском университете Медины, твердо придерживающийся саляфитского манхаджа и акиды Ахлю Сунна.",
      en: "Sheikh Salih Sindi is a well-known contemporary scholar and lecturer at the Islamic University of Madinah, adhering firmly to the Salafi manhaj and Aqeeda of Ahlus Sunnah.",
      ar: "الشيخ صالح سندي أستاذ العقيدة بالجامعة الإسلامية بالمدينة المنورة."
    }
  },
  {
    keywords: ["ауда", "ouda", "al-ouda", "салман ауда"],
    name: "Salman al-Ouda (Салман аль-Ауда)",
    classification: "ikhwan",
    details: {
      ru: "Салман аль-Ауда — один из ключевых идеологов кутбизма/ихванизма в Саудовской Аравии. Был строго предостережен авторитетными учеными (шейхом Ибн Базом и др.) за разжигание смуты и партийность.",
      en: "Salman al-Ouda is one of the key ideologues of Qutbism/Ikhwanism in Saudi Arabia. He was strongly warned against by scholars (such as Sheikh Ibn Baz) for inciting discord and partisanship.",
      ar: "سلمان العودة من أقطاب القطبية والإخوانية في المملكة العربية السعودية."
    }
  },
  {
    keywords: ["хазими", "hazimi", "al-hazimi", "ахмад хазими"],
    name: "Ahmad al-Hazimi (Ахмад аль-Хазими)",
    classification: "kharijite",
    details: {
      ru: "Ахмад аль-Хазими — проповедник, известный своими крайними такфиристскими взглядами (цепной такфир), которые классифицируются учеными как хариджитское отклонение.",
      en: "Ahmad al-Hazimi is a preacher known for his extreme takfiri views (chain takfir), which are classified by scholars as a Kharijite deviation.",
      ar: "أحمد الحازمي معروف بالغلو والتكفير المتسلسل وهو من رؤوس الخارجية المعاصرة."
    }
  }
];

// Функция принудительного переопределения личности проповедника
function applySpeakerOverrides(result, textContext, title = "", channel = "") {
  if (!result) return result;
  
  // Создаем объект speaker, если ИИ его не вернул
  if (!result.speaker) {
    result.speaker = { name: "Неизвестно", classification: "unknown", details: { ru: "", en: "", ar: "" } };
  }
  
  const searchString = `${result.speaker.name || ""} ${result.speaker.details?.ru || ""} ${title || ""} ${channel || ""} ${textContext || ""}`.toLowerCase();
  
  for (const item of SPEAKER_OVERRIDES) {
    // Проверяем совпадение по ключевым словам
    const matched = item.keywords.some(keyword => searchString.includes(keyword));
    if (matched) {
      // Исключение: если ищем шейха Салиха аль-Фаузана, а ключевое слово "аль-фаузан" совпало с Абдуллахом аль-Фаузаном
      if (item.keywords.includes("абдуллах аль-фаузан") && searchString.includes("салих")) {
        continue;
      }
      
      console.log(`[OVERRIDE] Принудительно сопоставлено: ${item.name}. Классификация: ${item.classification}`);
      result.speaker.name = item.name;
      result.speaker.classification = item.classification;
      result.speaker.details = item.details;
      
      // Корректируем общий вердикт в соответствии со статусом личности
      if (item.classification === "kharijite" || item.classification === "misguided") {
        result.verdict.rating = "Unreliable";
      } else if (item.classification === "ikhwan") {
        if (result.verdict.rating === "Safe") {
          result.verdict.rating = "Warning";
        }
      }
      break;
    }
  }
  return result;
}

// Запуск анализа видео
async function runVideoAnalysis(videoId, videoDetails) {
  // Получаем настройки провайдера из хранилища
  const settings = await new Promise(resolve => {
    chrome.storage.local.get([
      'apiProvider',
      'geminiApiKey',
      'geminiModel',
      'customApiBaseUrl',
      'customApiKey',
      'customApiModel'
    ], resolve);
  });

  const provider = settings.apiProvider || 'gemini';
  const apiKey = settings.geminiApiKey;
  const model = settings.geminiModel || 'gemini-2.5-flash';
  
  const customUrl = settings.customApiBaseUrl || 'http://localhost:11434/v1';
  const customKey = settings.customApiKey || '';
  const customModel = settings.customApiModel || 'llama3';

  if (provider === 'gemini' && !apiKey) {
    throw new Error("API-ключ Gemini не установлен. Откройте настройки расширения и укажите его.");
  }
  if (provider === 'custom' && (!customUrl || !customModel)) {
    throw new Error("Параметры Custom API не установлены. Откройте настройки расширения и укажите их.");
  }

  let transcriptText = "";
  let isMetadataMode = false;

  // Пробуем скачать субтитры на основе переданных треков из контент-скрипта
  if (videoDetails && videoDetails.captionTracks && videoDetails.captionTracks.length > 0) {
    try {
      const tracks = videoDetails.captionTracks;
      let selectedTrack = tracks.find(t => t.languageCode === 'ru') ||
                          tracks.find(t => t.languageCode === 'en') ||
                          tracks.find(t => t.languageCode === 'ar') ||
                          tracks[0];
      
      if (selectedTrack) {
        const transcriptResponse = await fetch(selectedTrack.baseUrl);
        if (transcriptResponse.ok) {
          const xmlText = await transcriptResponse.text();
          const parsed = parseTranscript(xmlText);
          if (parsed && parsed.length > 0) {
            transcriptText = parsed.map(p => p.text).join(' ');
          }
        }
      }
    } catch (e) {
      console.warn("Не удалось скачать субтитры из переданных данных, пробуем фоновый скрейпинг", e);
    }
  }

  // Если текст пустой, пробуем фоновый скрейпинг страницы
  if (!transcriptText) {
    try {
      const transcriptData = await getYouTubeTranscript(videoId);
      transcriptText = transcriptData.fullText;
    } catch (e) {
      console.warn("Фоновый парсинг субтитров не удался. Включаем анализ метаданных.", e);
      isMetadataMode = true;
    }
  }

  // Подготовка запроса к ИИ
  let promptInput = "";
  if (isMetadataMode) {
    const title = videoDetails?.title || "Неизвестное видео";
    const channel = videoDetails?.channel || "Неизвестный канал";
    const description = videoDetails?.description || "Описание отсутствует";
    promptInput = `Type: Video Metadata (Subtitles not available)\n\nTitle: ${title}\nChannel: ${channel}\nDescription: ${description}`;
  } else {
    promptInput = `Type: Speech Transcript\n\nContent:\n${transcriptText}`;
  }

  // Выполняем запрос к выбранному API
  let result;
  if (provider === 'gemini') {
    result = await callGeminiAPI(promptInput, apiKey, model);
  } else {
    result = await callCustomAPI(promptInput, customUrl, customKey, customModel);
  }
  
  return applySpeakerOverrides(result, transcriptText, videoDetails?.title, videoDetails?.channel);
}

// Запуск анализа произвольного текста или поиска хадисов
async function runTextAnalysis(text) {
  const settings = await new Promise(resolve => {
    chrome.storage.local.get([
      'apiProvider',
      'geminiApiKey',
      'geminiModel',
      'customApiBaseUrl',
      'customApiKey',
      'customApiModel'
    ], resolve);
  });

  const provider = settings.apiProvider || 'gemini';
  const apiKey = settings.geminiApiKey;
  const model = settings.geminiModel || 'gemini-2.5-flash';
  
  const customUrl = settings.customApiBaseUrl || 'http://localhost:11434/v1';
  const customKey = settings.customApiKey || '';
  const customModel = settings.customApiModel || 'llama3';

  if (provider === 'gemini' && !apiKey) {
    throw new Error("API-ключ Gemini не установлен. Откройте настройки расширения и укажите его.");
  }
  if (provider === 'custom' && (!customUrl || !customModel)) {
    throw new Error("Параметры Custom API не установлены. Откройте настройки расширения и укажите их.");
  }

  if (!text || text.trim().length < 5) {
    throw new Error("Текст слишком короткий для анализа.");
  }

  // Проверяем, является ли ввод пользователя коротким поисковым запросом хадиса
  const isSearchQuery = text.length < 150 && (
    /хадис/i.test(text) || /hadith/i.test(text) || 
    /сура/i.test(text) || /sura/i.test(text) || 
    /аят/i.test(text) || /verse/i.test(text) || 
    /бухари/i.test(text) || /муслим/i.test(text) ||
    /bukhari/i.test(text) || /muslim/i.test(text) ||
    /про /i.test(text) || /about /i.test(text) ||
    /цитат/i.test(text) || /коран/i.test(text) ||
    /quran/i.test(text)
  );

  let promptInput = "";
  if (isSearchQuery) {
    promptInput = `Type: Search Query or Topic check\n\nQuery: ${text}`;
  } else {
    promptInput = `Type: Speech Transcript\n\nContent:\n${text}`;
  }

  let result;
  if (provider === 'gemini') {
    result = await callGeminiAPI(promptInput, apiKey, model);
  } else {
    result = await callCustomAPI(promptInput, customUrl, customKey, customModel);
  }
  
  return applySpeakerOverrides(result, text);
}
// Отправка запроса к Gemini API
async function callGeminiAPI(text, apiKey, model) {
  const systemPrompt = `You are a strict and objective Islamic scholar, expert in Hadith science (Mustalah al-Hadith), Quranic exegesis (Tafsir), and history.
Your task is to analyze the user's input, which will be one of three types:
1. Speech Transcript: Speech from a video (representing the voices, spoken words, and verbal quotes on the video).
2. Video Metadata (Subtitles not available): Metadata (Title, Channel, Description).
3. Search Query or Topic check: A short search request (e.g., "Sahih al-Bukhari hadith about raising hands" or "Сура 2 аят 255").

YOU MUST CAREFULLY EXECUTE AND VERIFY THE FOLLOWING 5 CORE STEPS:
1. IDENTIFY AND CLASSIFY THE SPEAKER/PREACHER: Identify the name of the sheikh, preacher, speaker, or person on the video. Evaluate their manhaj/methodology and Aqeedah (creed) based on strict, objective facts and consensus of classic and contemporary Salafi scholars (Ahlus Sunnah wal-Jama'ah).
Classify them into one of these categories:
- "salafi" (Ahlus Sunnah: e.g., Sh. Bin Baz, Sh. al-Albanee, Sh. Ibn Uthaymeen, Sh. Rabi' al-Madkhalee, Sh. Salih al-Fawzan, Sh. Abdul-Muhsin al-Abbad, etc.).
- "ikhwan" (Muslim Brotherhood / Ikhwanul Muslimin / Qutbiyyah: e.g., Sh. Salman al-Ouda, Sh. Muhammad al-Arifi, Sh. Sulaiman al-Alwan, Sh. Abdul-Aziz al-Tarifi, Sh. Abdullah al-Fawzan, Yusuf al-Qaradawi, etc.).
- "kharijite" (Takfiri / Khawarij / extremist ideologies: e.g., Sh. Suleiman al-Ulwan (due to some of his takfiri opinions), Ahmad al-Hazimi, Ayman al-Zawahiri, Abu Muhammad al-Maqdisi).
- "doubtful" (сомнительная личность: speakers with mixed manhaj or unclear stances).
- "misguided" (заблудший: speakers openly spreading innovations (bid'ah) or calling to deviated sects).
- "unknown" (for non-Islamic speakers or when unknown).

CRITICAL RULE FOR SPEAKER CLASSIFICATION:
You must strictly separate Ahlus Sunnah (Salafiyyah) from Ikhwanis, Takfiris/Khawarij, and Ash'aris/Maturidis.
- Sheikh Rabi' al-Madkhalee is a well-known Salafi scholar, not misguided.
- Sulaiman al-Ulwan (Suleiman al-Ouda / al-Tarifi / al-Arifi) are leaning towards Ikhwani / Qutbi / Takfiri methodologies, they are NOT Salafis.
- Classified speaker details MUST explain their manhaj clearly in the 'speaker' object.

2. ANALYZE THE QUESTION: Identify the core question, debate, issue, or topic being discussed on the video. Explain this issue in the final verdict summary.
3. ANALYZE CITATIONS AND TRANSLATIONS: Identify every Quranic verse, Hadith (Bukhari, Muslim, Sunan, Kitab at-Tawhid, etc.), or quote. Analyze the translation provided by the speaker or search query. Verify if the translation and text quoted on the video are accurate, modified, or completely distorted.
4. HADITH AND VERSE VERIFICATION: Cross-reference and verify all citations against authentic Islamic sources. For each, determine the authenticity rating (Sahih, Hasan, Da'if, Maudu', or Unknown) and specify a direct working verification link (e.g. sunnah.com or quran.com).
5. MULTI-SOURCE ANALYSIS: Analyze the title, the description, and the spoken voices (represented by the transcript). If the transcript is missing, make a thorough evaluation of the topic, preacher, and related authentic texts based on the title and description.

GUIDELINES FOR INPUT TYPES:
- If input is SEARCH QUERY or TOPIC check:
  Search your knowledge for the exact Hadith(s) or Quranic verse(s). Populate them in the 'citations' array. Give original text in Arabic, Russian, and English, authenticity status, and direct sunnah.com/quran.com links. In 'verdict', summarize the meaning, the rule, and authenticity. Set verdict rating to "Safe" if the requested sources exist and are authentic.
- If input is VIDEO METADATA (Title, Channel, Description):
  Explain that subtitles are missing. Give a general verdict/summary of this video's topic or speaker in 'verdict'. Since subtitles are missing, you MUST search your own database and cite at least 1-2 authentic Hadiths or Quranic verses directly related to this topic or the speaker's known views, and place them in the 'citations' array as references for verification. DO NOT return an empty citations array.
- If input is SPEECH TRANSCRIPT:
  Scan for quotes from Quran, Hadith (Bukhari, Muslim, etc.), or scholars. For each: put it in 'citations', check if speaker lied/misquoted or quoted accurately. Give authenticity status and verification links. In 'verdict', summarize the video's core message, identify the preacher, and rate credibility (Safe/Warning/Unreliable).

AUTHENTICITY RATINGS:
- Sahih, Hasan, Da'if, Maudu', or Unknown.

IMPORTANT: You MUST respond strictly in JSON format. The response must map exactly to the following JSON schema:
{
  "verdict": {
    "rating": "Safe" | "Warning" | "Unreliable",
    "summary": {
      "ru": "Общий вывод на русском языке: 1. Укажите имя шейха/проповедника. 2. Объясните основной вопрос/тему видео. 3. Подведите итог достоверности слов спикера и его источников.",
      "en": "General verdict in English: 1. State the preacher/speaker's name. 2. Explain the core question/topic. 3. Summarize the authenticity of the claims and sources.",
      "ar": "الخلاصة العامة باللغة العربية: 1. حدد اسم الشيخ/الداعية. 2. اشرح السؤال/الموضوع الأساسي. 3. لخص مدى صحة الادعاءات والمصادر."
    }
  },
  "speaker": {
    "name": "Name of the sheikh/preacher",
    "classification": "salafi" | "ikhwan" | "kharijite" | "doubtful" | "misguided" | "unknown",
    "details": {
      "ru": "Детальный разбор منهج и عقيدة спикера на русском языке. Объясните выбор классификации на основе его известных лекций, взглядов и оценок авторитетных саляфитских ученых.",
      "en": "Detailed analysis of methodology and beliefs in English. Explain classification.",
      "ar": "تحليل تفصيلي لمنهج وعقيدة المتحدث باللغة العربية."
    }
  },
  "citations": [
    {
      "spokenText": "The text query or spoken quote fragment",
      "reference": "Exact citation name (e.g., Quran 3:103 or Bukhari 243)",
      "authenticity": "Sahih" | "Hasan" | "Da'if" | "Maudu'" | "Unknown",
      "verificationLink": "Direct HTTPS link to sunnah.com or quran.com (e.g., https://sunnah.com/bukhari:243 or https://quran.com/3/103)",
      "accuracyCheck": {
        "ru": "Анализ точности цитаты спикера или детальное описание хадиса/аята на русском.",
        "en": "Analysis of the citation accuracy or detailed description of the hadith/verse in English.",
        "ar": "تحليل دقة الاقتباس أو وصف تفصيلي للحديث/الآية باللغة العربية."
      },
      "originalText": {
        "ru": "Точный оригинальный текст цитаты на русском языке",
        "en": "Exact original text of the citation in English",
        "ar": "النص الأصلي الدقيق للاقتباس باللغة العربية"
      }
    }
  ]
}

If no quotes or Islamic references are found or relevant, return an empty array for citations.
Return ONLY the raw JSON. Do not write markdown tags (like \`\`\`json ... \`\`\`).`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: systemPrompt },
            { text: `Here is the input to analyze:\n\n${text}` }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `API Error (${response.status})`;
    try {
      const errJson = JSON.parse(errorText);
      errorMessage = errJson.error?.message || errorMessage;
    } catch (_) {}
    throw new Error(`Ошибка Gemini API: ${errorMessage}`);
  }

  const data = await response.json();
  const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!jsonText) {
    throw new Error("Не удалось получить текстовый ответ от Gemini API.");
  }

  try {
    const parsedData = JSON.parse(jsonText);
    return parsedData;
  } catch (err) {
    console.error("Ошибка парсинга JSON от ИИ:", jsonText);
    throw new Error("ИИ вернул некорректный формат данных. Попробуйте еще раз.");
  }
}

// Отправка запроса к Custom API (Ollama / DeepSeek и др.)
async function callCustomAPI(text, baseUrl, apiKey, model) {
  // Промпт ИИ дублирует системные правила Gemini
  const systemPrompt = `You are a strict and objective Islamic scholar, expert in Hadith science (Mustalah al-Hadith), Quranic exegesis (Tafsir), and history.
Your task is to analyze the user's input, which will be one of three types:
1. Speech Transcript: Speech from a video.
2. Video Metadata (Subtitles not available): Title, Channel, Description.
3. Search Query or Topic check: A short search request.

YOU MUST CAREFULLY EXECUTE AND VERIFY THE FOLLOWING 5 CORE STEPS:
1. IDENTIFY AND CLASSIFY THE SPEAKER/PREACHER: Identify the preacher, speaker, or sheikh. Evaluate their manhaj/methodology and Aqeedah (creed) based on strict, objective facts and consensus of classic and contemporary Salafi scholars (Ahlus Sunnah wal-Jama'ah).
Classify them into one of these categories:
- "salafi" (Ahlus Sunnah: e.g., Sh. Bin Baz, Sh. al-Albanee, Sh. Ibn Uthaymeen, Sh. Rabi' al-Madkhalee, Sh. Salih al-Fawzan, Sh. Abdul-Muhsin al-Abbad, etc.).
- "ikhwan" (Muslim Brotherhood / Ikhwanul Muslimin / Qutbiyyah: e.g., Sh. Salman al-Ouda, Sh. Muhammad al-Arifi, Sh. Sulaiman al-Alwan, Sh. Abdul-Aziz al-Tarifi, Sh. Abdullah al-Fawzan, Yusuf al-Qaradawi, etc.).
- "kharijite" (Takfiri / Khawarij / extremist ideologies: e.g., Sh. Suleiman al-Ulwan (due to some of his takfiri opinions), Ahmad al-Hazimi, Ayman al-Zawahiri, Abu Muhammad al-Maqdisi).
- "doubtful" (сомнительная личность: speakers with mixed manhaj or unclear stances).
- "misguided" (заблудший: speakers openly spreading innovations (bid'ah) or calling to deviated sects).
- "unknown" (for non-Islamic speakers or when unknown).

CRITICAL RULE FOR SPEAKER CLASSIFICATION:
You must strictly separate Ahlus Sunnah (Salafiyyah) from Ikhwanis, Takfiris/Khawarij, and Ash'aris/Maturidis.
- Sheikh Rabi' al-Madkhalee is a well-known Salafi scholar, not misguided.
- Sulaiman al-Ulwan (Suleiman al-Ouda / al-Tarifi / al-Arifi) are leaning towards Ikhwani / Qutbi / Takfiri methodologies, they are NOT Salafis.
- Classified speaker details MUST explain their manhaj clearly in the 'speaker' object.

2. ANALYZE THE QUESTION: Identify the core question or topic being discussed.
3. ANALYZE CITATIONS AND TRANSLATIONS: Identify every Quranic verse, Hadith, or quote. Verify if the translation is accurate.
4. HADITH AND VERSE VERIFICATION: Cross-reference and verify all citations against authentic Islamic sources. Determine the authenticity rating (Sahih, Hasan, Da'if, Maudu', or Unknown) and specify a direct working verification link (e.g. sunnah.com or quran.com).
5. MULTI-SOURCE ANALYSIS: Analyze title, description, and voices (transcript).

GUIDELINES FOR INPUT TYPES:
- If input is SEARCH QUERY or TOPIC check:
  Search your knowledge for the exact Hadith(s) or Quranic verse(s). Populate them in the 'citations' array. Give original text in Arabic, Russian, and English, authenticity status, and direct sunnah.com/quran.com links. In 'verdict', summarize the meaning, the rule, and authenticity. Set verdict rating to "Safe" if the requested sources exist and are authentic.
- If input is VIDEO METADATA (Title, Channel, Description):
  Explain that subtitles are missing. Give a general verdict/summary of this video's topic or speaker in 'verdict'. Since subtitles are missing, you MUST search your own database and cite at least 1-2 authentic Hadiths or Quranic verses directly related to this topic or the speaker's known views, and place them in the 'citations' array as references for verification. DO NOT return an empty citations array.
- If input is SPEECH TRANSCRIPT:
  Scan for quotes from Quran, Hadith (Bukhari, Muslim, etc.), or scholars. For each: put it in 'citations', check if speaker lied/misquoted or quoted accurately. Give authenticity status and verification links. In 'verdict', summarize the video's core message, identify the preacher, and rate credibility (Safe/Warning/Unreliable).

IMPORTANT: You MUST respond strictly in JSON format. The response must map exactly to the following JSON schema:
{
  "verdict": {
    "rating": "Safe" | "Warning" | "Unreliable",
    "summary": {
      "ru": "Общий вывод на русском языке: 1. Укажите имя шейха/проповедника. 2. Объясните основной вопрос/тему видео. 3. Подведите итог достоверности слов спикера.",
      "en": "General verdict in English. Summarize the video/query.",
      "ar": "الخلاصة العامة باللغة العربية."
    }
  },
  "speaker": {
    "name": "Name of the sheikh/preacher",
    "classification": "salafi" | "ikhwan" | "kharijite" | "doubtful" | "misguided" | "unknown",
    "details": {
      "ru": "Детальный разбор منهج и عقيدة спикера на русском языке. Объясните выбор классификации.",
      "en": "Detailed analysis of methodology in English.",
      "ar": "تحليل تفصيلي لمنهج وعقيدة المتحدث باللغة العربية."
    }
  },
  "citations": [
    {
      "spokenText": "The text query or spoken quote fragment",
      "reference": "Exact citation name",
      "authenticity": "Sahih" | "Hasan" | "Da'if" | "Maudu'" | "Unknown",
      "verificationLink": "Direct HTTPS link to sunnah.com or quran.com",
      "accuracyCheck": {
        "ru": "Анализ точности цитаты спикера или детальное описание на русском.",
        "en": "Analysis of the citation accuracy in English.",
        "ar": "تحليل دقة الاقتباس باللغة العربية."
      },
      "originalText": {
        "ru": "Точный оригинальный текст цитаты на русском",
        "en": "Exact original text of the citation in English",
        "ar": "النص الأصلي الدقيق للاقتباس باللغة العربية"
      }
    }
  ]
}

If no quotes are found, return an empty array for citations.
Return ONLY the raw JSON. Do not write markdown tags (like \`\`\`json ... \`\`\`).`;

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Here is the input to analyze:\n\n${text}` }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ошибка Custom API (${response.status}): ${errorText || response.statusText}`);
  }

  const data = await response.json();
  const jsonText = data.choices?.[0]?.message?.content;
  
  if (!jsonText) {
    throw new Error("Не удалось получить текстовый ответ от Custom API.");
  }

  try {
    let cleanJson = jsonText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    }
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error("Ошибка парсинга JSON от Custom API:", jsonText);
    throw new Error("ИИ Custom API вернул некорректный формат данных. Попробуйте еще раз.");
  }
}
