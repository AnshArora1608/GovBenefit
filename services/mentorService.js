const fs = require('fs');
const path = require('path');
const { matchFieldToProfile } = require('./profileMapper');
const { getProfilesData } = require('./profileService');

const KNOWLEDGE_DIR = path.join(__dirname, '..', 'data', 'knowledge');

/**
 * Loads knowledge base for the given scheme (default: pmegp).
 */
function getSchemeKnowledge(schemeId = 'pmegp') {
  const file = path.join(KNOWLEDGE_DIR, `${schemeId.toLowerCase()}_form.json`);
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.error('Error reading knowledge file:', err);
    }
  }
  return null;
}

/**
 * Detects whether a field is a sensitive human-only action.
 */
function detectSensitiveBoundary(fieldInfo, lang = 'en') {
  const isHi = lang === 'hi';
  const text =
    `${fieldInfo.id || ''} ${fieldInfo.name || ''} ${fieldInfo.labelText || ''} ${fieldInfo.type || ''}`.toLowerCase();

  if (
    /captcha|recaptcha|hcaptcha|turnstile|security_code|verify_code/i.test(text)
  ) {
    return {
      isSensitive: true,
      sensitiveType: 'CAPTCHA',
      boundaryMessage: isHi
        ? '🔒 मानवीय कार्रवाई आवश्यक: आपकी सुरक्षा और सरकारी पोर्टल के नियमों के अनुसार GovBenefit कैप्चा कोड स्वचालित रूप से नहीं भरेगा। कृपया छवि देखकर कोड स्वयं दर्ज करें।'
        : '🔒 Human Action Required: For your security and portal anti-bot verification, GovBenefit will not solve or enter the CAPTCHA. Please read the image and type the code yourself.',
    };
  }

  if (
    /\botp\b|one[-_\s]?time[-_\s]?password|verification[-_\s]?code/i.test(text)
  ) {
    return {
      isSensitive: true,
      sensitiveType: 'OTP',
      boundaryMessage: isHi
        ? '🔒 मानवीय कार्रवाई आवश्यक: वन-टाइम पासवर्ड (OTP) आपके पंजीकृत मोबाइल/ईमेल पर गोपनीय रूप से भेजा जाता है। कृपया इसे स्वयं दर्ज करें।'
        : '🔒 Human Action Required: The One-Time Password (OTP) is sent privately to your registered mobile/email. Please enter it yourself.',
    };
  }

  if (
    /declaration|undertaking|consent|i_agree|agree_terms|terms_agree/i.test(
      text
    )
  ) {
    return {
      isSensitive: true,
      sensitiveType: 'DECLARATION',
      boundaryMessage: isHi
        ? '🔒 मानवीय कार्रवाई आवश्यक: GovBenefit आपकी ओर से कानूनी घोषणा या सहमति स्वीकार नहीं करेगा। कृपया शर्तें पढ़ें और चेकबॉक्स स्वयं टिक करें।'
        : '🔒 Human Action Required: GovBenefit will never accept legal declarations or undertakings on your behalf. Please read the terms carefully and check the box yourself.',
    };
  }

  if (
    fieldInfo.type === 'submit' ||
    /submit|save_application|btn_submit/i.test(text)
  ) {
    return {
      isSensitive: true,
      sensitiveType: 'SUBMIT',
      boundaryMessage: isHi
        ? '🔒 मानवीय कार्रवाई आवश्यक: GovBenefit कभी भी आवेदन को स्वचालित रूप से सबमिट नहीं करता है। कृपया सभी फ़ील्ड की जांच करें और स्वयं सबमिट बटन दबाएं।'
        : '🔒 Human Action Required: GovBenefit never auto-submits applications. Please review all fields, verify attached documents, and click Submit yourself.',
    };
  }

  if (/signature|biometric|fingerprint|iris/i.test(text)) {
    return {
      isSensitive: true,
      sensitiveType: 'BIOMETRIC_SIGNATURE',
      boundaryMessage: isHi
        ? '🔒 मानवीय कार्रवाई आवश्यक: बायोमेट्रिक सत्यापन और डिजिटल हस्ताक्षर आवेदक द्वारा भौतिक रूप से दिए जाने आवश्यक हैं।'
        : '🔒 Human Action Required: Biometric verification and legal digital signatures must be physically provided by the applicant.',
    };
  }

  return { isSensitive: false };
}

/**
 * Parses and intercepts recognized voice commands.
 */
function parseVoiceCommand(question) {
  const q = String(question || '')
    .trim()
    .toLowerCase();

  // 1. Repeat
  if (
    /^(repeat|again|say again|speak again|फिर से बोलो|दोहराओ|दोबारा बताओ|दोबारा बोलो)$/i.test(
      q
    )
  ) {
    return {
      isCommand: true,
      command: 'repeat',
      message: 'दोहराया जा रहा है / Repeating last guidance.',
    };
  }

  // 2. Slow Down
  if (
    /^(slow down|speak slow|slower|धीरे बोलो|धीमी आवाज|धीमी गति|धीमे बोलो)$/i.test(
      q
    )
  ) {
    return {
      isCommand: true,
      command: 'slow_down',
      rate: 0.8,
      message:
        'बोलने की गति धीमी कर दी गई है / Speaking speed slowed down to 0.8x.',
    };
  }

  // 3. Normal Speed
  if (/^(normal speed|speed up|faster|सामान्य गति|तेज बोलो)$/i.test(q)) {
    return {
      isCommand: true,
      command: 'normal_speed',
      rate: 1.0,
      message: 'बोलने की गति सामान्य कर दी गई है / Speaking speed set to 1.0x.',
    };
  }

  // 4. Change Language to Hindi
  if (
    /^(change language to hindi|speak in hindi|switch to hindi|hindi me bolo|हिंदी में बोलो|हिंदी)$/i.test(
      q
    )
  ) {
    return {
      isCommand: true,
      command: 'change_lang',
      lang: 'hi',
      message: 'भाषा बदलकर हिन्दी कर दी गई है।',
    };
  }

  // 5. Change Language to English
  if (
    /^(change language to english|speak in english|switch to english|english me bolo|अंग्रेजी में बोलो|english)$/i.test(
      q
    )
  ) {
    return {
      isCommand: true,
      command: 'change_lang',
      lang: 'en',
      message: 'Language switched to English.',
    };
  }

  return { isCommand: false };
}

/**
 * Inspects a field and produces complete Form Mentor guidance (Bilingual: en / hi).
 */
function inspectField(fieldInfo, schemeId = 'pmegp', lang = 'en') {
  const isHi = lang === 'hi';
  const knowledge = getSchemeKnowledge(schemeId) || { fields: {} };
  const fieldsKB = knowledge.fields || {};

  // 1. Check human-action boundary guardrails first
  const boundaryCheck = detectSensitiveBoundary(fieldInfo, lang);
  if (boundaryCheck.isSensitive) {
    return {
      fieldId: fieldInfo.id,
      fieldName: fieldInfo.name,
      isSensitive: true,
      sensitiveType: boundaryCheck.sensitiveType,
      boundaryMessage: boundaryCheck.boundaryMessage,
      meaning: isHi
        ? `सुरक्षा सीमा (${boundaryCheck.sensitiveType})`
        : `Security Boundary (${boundaryCheck.sensitiveType})`,
      whatToEnter: isHi
        ? 'नागरिक द्वारा प्रत्यक्ष मानवीय कार्रवाई आवश्यक।'
        : 'Human manual action required.',
      whyRequired: isHi
        ? 'कानूनी, सुरक्षा और गोपनीयता नियमों के अनुसार केवल वास्तविक नागरिक को ही यह चरण पूरा करने की अनुमति है।'
        : 'Legal, security, and privacy regulations mandate that only the human applicant perform this step.',
      profileMatch: null,
      optionsBreakdown: [],
    };
  }

  // 2. Identify corresponding knowledge entry
  let kbEntry = null;
  const testKey = (fieldInfo.id || fieldInfo.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');

  for (const [key, item] of Object.entries(fieldsKB)) {
    if (
      key === testKey ||
      (item.aliases && item.aliases.some((a) => testKey.includes(a)))
    ) {
      kbEntry = item;
      break;
    }
  }

  // Fallback if not specifically named in KB: use label text heuristics
  if (!kbEntry && fieldInfo.labelText) {
    const normLabel = fieldInfo.labelText.toLowerCase();
    for (const item of Object.values(fieldsKB)) {
      if (normLabel.includes(item.label.toLowerCase().slice(0, 8))) {
        kbEntry = item;
        break;
      }
    }
  }

  // 3. Match against user's GovBenefit profile
  const profileMatch = matchFieldToProfile(fieldInfo);

  // 4. Enrich dropdown options if present
  let enrichedOptions = [];
  if (Array.isArray(fieldInfo.options) && fieldInfo.options.length > 0) {
    const kbOptions =
      kbEntry && Array.isArray(kbEntry.options) ? kbEntry.options : [];

    enrichedOptions = fieldInfo.options.map((opt) => {
      const optVal = String(opt.value || '').trim();
      const optText = String(opt.label || opt.text || optVal).trim();

      const foundKb = kbOptions.find(
        (kbo) =>
          kbo.value.toLowerCase() === optVal.toLowerCase() ||
          optText.toLowerCase().includes(kbo.value.toLowerCase())
      );

      // Check if this option corresponds to the citizen's profile
      let isProfileMatch = false;
      if (profileMatch && profileMatch.matched && profileMatch.savedValue) {
        const normProfileVal = String(profileMatch.savedValue).toLowerCase();
        isProfileMatch =
          optVal.toLowerCase() === normProfileVal ||
          optText.toLowerCase().includes(normProfileVal);
      }

      return {
        value: optVal,
        label: isHi && foundKb && foundKb.label_hi ? foundKb.label_hi : optText,
        meaning:
          isHi && foundKb && foundKb.meaning_hi
            ? foundKb.meaning_hi
            : foundKb
              ? foundKb.meaning
              : isHi
                ? 'इस फ़ील्ड के लिए मानक विकल्प।'
                : 'Standard option for this field.',
        whoShouldChoose:
          isHi && foundKb && foundKb.whoShouldChoose_hi
            ? foundKb.whoShouldChoose_hi
            : foundKb
              ? foundKb.whoShouldChoose
              : isHi
                ? 'यदि यह आपकी इकाई से मेल खाता है तो चुनें।'
                : 'Select if this reflects your enterprise category.',
        isProfileMatch,
      };
    });
  }

  // Resolve bilingual strings
  const label =
    isHi && kbEntry && kbEntry.label_hi
      ? kbEntry.label_hi
      : (kbEntry && kbEntry.label) ||
        fieldInfo.labelText ||
        fieldInfo.name ||
        'Form Field';
  const meaning =
    isHi && kbEntry && kbEntry.meaning_hi
      ? kbEntry.meaning_hi
      : (kbEntry && kbEntry.meaning) ||
        (isHi
          ? 'योजना सत्यापन हेतु आवश्यक आधिकारिक फ़ील्ड।'
          : 'Standard application form field required for scheme verification.');
  const whatToEnter =
    isHi && kbEntry && kbEntry.whatToEnter_hi
      ? kbEntry.whatToEnter_hi
      : (kbEntry && kbEntry.whatToEnter) ||
        (isHi ? `अपना ${label} दर्ज करें।` : `Enter your ${label}.`);
  const format =
    isHi && kbEntry && kbEntry.format_hi
      ? kbEntry.format_hi
      : (kbEntry && kbEntry.format) ||
        (fieldInfo.type === 'number'
          ? isHi
            ? 'अंकीय संख्या'
            : 'Numeric digits'
          : isHi
            ? 'मानक टेक्स्ट'
            : 'Standard text');
  const whyRequired =
    isHi && kbEntry && kbEntry.whyRequired_hi
      ? kbEntry.whyRequired_hi
      : (kbEntry && kbEntry.whyRequired) ||
        (isHi
          ? 'पात्रता स्थापित करने और आधिकारिक रिकॉर्ड हेतु अनिवार्य।'
          : 'Mandatory parameter to establish applicant eligibility and maintain official records.');

  // 5. Construct final response
  return {
    fieldId: fieldInfo.id,
    fieldName: fieldInfo.name,
    lang,
    label,
    meaning,
    whatToEnter,
    format,
    whyRequired,
    isSensitive: false,
    profileMatch: profileMatch.matched
      ? {
          fieldKey: profileMatch.fieldKey,
          profilePath: profileMatch.profilePath,
          savedValue: profileMatch.savedValue,
          displayValue: profileMatch.displayValue,
          confidence: profileMatch.confidence,
          requiresConfirmation: true,
        }
      : null,
    optionsBreakdown: enrichedOptions,
  };
}

/**
 * Answers contextual AI mentor questions from the citizen (Bilingual: en / hi).
 */
function askMentor(
  question,
  fieldContext = {},
  schemeId = 'pmegp',
  lang = 'en'
) {
  const rawQ = String(question || '').trim();
  const q = rawQ.toLowerCase();

  // Check voice commands first
  const cmd = parseVoiceCommand(rawQ);
  if (cmd.isCommand) {
    return {
      isCommand: true,
      command: cmd.command,
      lang: cmd.lang,
      rate: cmd.rate,
      answer: cmd.message,
    };
  }

  // Auto-detect Hindi language query if user speaks in Hindi/Devanagari
  const hasHindiChars =
    /[\u0900-\u097F]/.test(rawQ) ||
    /kya|kyu|kaise|matlab|batao|kripya|bol|chahiye/i.test(q);
  const isHi = lang === 'hi' || hasHindiChars;

  const knowledge = getSchemeKnowledge(schemeId) || { fields: {} };
  const fieldKey =
    fieldContext.fieldKey ||
    fieldContext.fieldName ||
    fieldContext.fieldId ||
    '';
  const kbEntry = knowledge.fields ? knowledge.fields[fieldKey] : null;
  const userProfile = getProfilesData().user || {};

  const label = isHi
    ? (kbEntry && kbEntry.label_hi) || fieldContext.label || 'इस फ़ील्ड'
    : (kbEntry && kbEntry.label) || fieldContext.label || 'this field';

  // 1. "What does this option mean?"
  if (
    q.includes('option') ||
    q.includes('meaning') ||
    q.includes('मतलब') ||
    q.includes('अर्थ') ||
    q.includes('विकल्प')
  ) {
    if (kbEntry && kbEntry.options && kbEntry.options.length > 0) {
      const list = kbEntry.options
        .map((o) => {
          const optLabel = isHi && o.label_hi ? o.label_hi : o.label;
          const optMeaning = isHi && o.meaning_hi ? o.meaning_hi : o.meaning;
          const optWho =
            isHi && o.whoShouldChoose_hi
              ? o.whoShouldChoose_hi
              : o.whoShouldChoose;
          return `• **${optLabel}**: ${optMeaning} (${optWho})`;
        })
        .join('\n\n');

      return {
        answer: isHi
          ? `**${label}** के विकल्पों की व्याख्या:\n\n${list}`
          : `Here is the explanation of the options for **${label}**:\n\n${list}`,
      };
    }
    return {
      answer: isHi
        ? `यह ड्रॉपडाउन ${label} के लिए सरकारी श्रेणियां दर्शाता है। कृपया अपने दस्तावेज़ों के अनुसार विकल्प चुनें।`
        : `This dropdown presents predefined government categories for ${label}. Please select the option matching your official documents.`,
    };
  }

  // 2. "Why is this required?" / "Why is this asked?"
  if (
    q.includes('why') ||
    q.includes('required') ||
    q.includes('क्यो') ||
    q.includes('क्यों') ||
    q.includes('कारण') ||
    q.includes('जरूरी')
  ) {
    const why = isHi
      ? kbEntry && kbEntry.whyRequired_hi
      : kbEntry && kbEntry.whyRequired;
    if (why) {
      return {
        answer: isHi
          ? `**${label} क्यों अनिवार्य है:**\n\n${why}`
          : `**Why this is required for ${label}:**\n\n${why}`,
      };
    }
    return {
      answer: isHi
        ? 'यह जानकारी आपकी पात्रता प्रमाणित करने और सरकारी सब्सिडी आवंटन के कानूनी सत्यापन हेतु अनिवार्य है।'
        : 'This information is legally required by the administrative department to verify your eligibility and allocate government subsidies.',
    };
  }

  // 3. "What should I enter here?" / "How to fill?"
  if (
    q.includes('what should i enter') ||
    q.includes('how to fill') ||
    q.includes('क्या भरें') ||
    q.includes('भरना') ||
    q.includes('कैसे भरें')
  ) {
    let text = isHi
      ? (kbEntry && kbEntry.whatToEnter_hi) ||
        `अपने आधिकारिक दस्तावेज़ों के अनुसार विवरण दर्ज करें।`
      : (kbEntry && kbEntry.whatToEnter) ||
        `Enter details matching your official identity proofs.`;

    const fmt = isHi ? kbEntry && kbEntry.format_hi : kbEntry && kbEntry.format;
    if (fmt) {
      text += isHi
        ? `\n\n**प्रारूप (Format):** ${fmt}`
        : `\n\n**Expected format:** ${fmt}`;
    }
    return { answer: text };
  }

  // 4. Agency specific question (KVIC vs KVIB vs DIC)
  if (
    q.includes('kvic') ||
    q.includes('kvib') ||
    q.includes('dic') ||
    q.includes('agency') ||
    q.includes('एजेंसी')
  ) {
    if (isHi) {
      return {
        answer:
          `**आपको कौन सी एजेंसी चुननी चाहिए?**\n\n` +
          `• **डीआईसी (DIC - जिला उद्योग केंद्र)**: यदि आपकी दुकान या उद्यम **शहरी क्षेत्र** में है, तो DIC सबसे उपयुक्त है।\n` +
          `• **केवीआईबी (KVIB - राज्य खादी बोर्ड)**: यदि आपकी इकाई पूरी तरह **ग्रामीण ग्राम पंचायत क्षेत्र** में स्थित है।\n` +
          `• **केवीआईसी (KVIC - केंद्रीय आयोग)**: खादी एवं पारंपरिक ग्रामोद्योग इकाइयों के लिए केंद्रीय नोडल एजेंसी।\n\n` +
          `*सुझाव:* अधिकांश एकल निर्माण व सेवा व्यवसायी **DIC** के माध्यम से आवेदन करते हैं।`,
      };
    }
    return {
      answer:
        `**Which agency should you choose?**\n\n` +
        `• **DIC (District Industries Centre)**: Best if your enterprise is in an **urban area** or industrial cluster.\n` +
        `• **KVIB (Khadi & Village Industries Board)**: Recommended if your unit is strictly in a **rural village / gram panchayat**.\n` +
        `• **KVIC (Central Commission)**: Central nodal agency for village industries and khadi units.\n\n` +
        `*Tip:* Most solo manufacturing and service businesses in district headquarters apply through **DIC**.`,
    };
  }

  // 5. Subsidy / Category specific question
  if (
    q.includes('subsidy') ||
    q.includes('subsidy rate') ||
    q.includes('छूट') ||
    q.includes('सब्सिडी') ||
    q.includes('मार्जिन मनी')
  ) {
    const gender = userProfile.personal ? userProfile.personal.gender : '';
    const cat = userProfile.demographics
      ? userProfile.demographics.socialCat
      : '';

    if (isHi) {
      let subsidyInfo =
        `PMEGP योजना में सब्सिडी (मार्जिन मनी) की दरें:\n\n` +
        `• **सामान्य वर्ग (पुरुष)**: शहरी क्षेत्र में 15%, ग्रामीण क्षेत्र में 25%। स्वयं का अंशदान: 10%।\n` +
        `• **विशेष श्रेणी (महिलाएं / एससी / एसटी / ओबीसी / अल्पसंख्यक / दिव्यांग / पूर्व सैनिक)**: शहरी क्षेत्र में 25%, ग्रामीण क्षेत्र में 35%। स्वयं का अंशदान: केवल 5%।\n\n`;

      if (gender === 'female' || ['OBC', 'SC', 'ST'].includes(cat)) {
        subsidyInfo += `✨ *आपकी सहेजी गई प्रोफ़ाइल (${cat || ''} ${gender === 'female' ? 'महिला' : ''}) के अनुसार, आप **विशेष श्रेणी उच्च सब्सिडी (35% तक)** के लिए पात्र हैं!*`;
      }
      return { answer: subsidyInfo };
    }

    let subsidyInfo =
      `Under PMEGP, subsidies (Margin Money) are calculated as follows:\n\n` +
      `• **General Category (Male)**: 15% in Urban areas, 25% in Rural areas. Own contribution required: 10%.\n` +
      `• **Special Category (SC / ST / OBC / Women / Minority / PwD / Ex-Servicemen)**: 25% in Urban areas, 35% in Rural areas. Own contribution required: only 5%.\n\n`;

    if (gender === 'female' || ['OBC', 'SC', 'ST'].includes(cat)) {
      subsidyInfo += `✨ *Based on your saved profile (${cat || ''} ${gender || ''}), you qualify for the higher **Special Category subsidy (up to 35%)**!*`;
    }
    return { answer: subsidyInfo };
  }

  // Default contextual assistance
  if (isHi) {
    return {
      answer: `**${label}** के लिए: ${kbEntry && kbEntry.meaning_hi ? kbEntry.meaning_hi : 'सरकारी दस्तावेजों के अनुसार सटीक विवरण दर्ज करें।'}\n\n*प्रारूप:* ${kbEntry && kbEntry.format_hi ? kbEntry.format_hi : 'मानक विवरण।'}`,
    };
  }

  return {
    answer: `For **${label}**: ${kbEntry ? kbEntry.meaning : 'Enter details accurately as per your official government certificates.'}\n\n*Format:* ${kbEntry ? kbEntry.format : 'Standard alphanumeric input.'}`,
  };
}

module.exports = {
  getSchemeKnowledge,
  inspectField,
  askMentor,
  parseVoiceCommand,
  detectSensitiveBoundary,
};
