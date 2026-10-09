// services/needTranslator.js
// Hindi / Hinglish -> English keywords, so the TF-IDF model (trained on English scheme text) can understand spoken or typed Hindi.
// No ML model needed: just a small word list. Add more words any time.
const nfc = s => String(s || "").normalize("NFC");

// [roman words, devanagari words, english keywords to add]
const LEXICON = [
  ["loan|karz|karza|udhaar|credit|finance", "कर्ज|कर्जा|ऋण|लोन|उधार", "loan credit"],
  ["business|vyapar|vyavsay|dhandha|dhanda|karobar|dukan|dukaan|shop|udyog|swarozgar|bizness", "व्यापार|व्यवसाय|धंधा|कारोबार|दुकान|उद्योग|बिज़नेस|बिजनेस|स्वरोजगार|रोजगार शुरू", "business enterprise entrepreneur self employment"],
  ["startup|naya kaam", "स्टार्टअप|नया काम", "startup entrepreneur"],
  ["kheti|kisan|fasal|krishi|farm|farmer|khad|beej|sinchai", "खेती|किसान|फसल|कृषि|खाद|बीज|सिंचाई", "agriculture farmer crop farming"],
  ["padhai|padhna|shiksha|school|college|fees|chhatravriti|scholarship|vidyarthi|student", "पढ़ाई|पढाई|शिक्षा|स्कूल|कॉलेज|फीस|छात्रवृत्ति|स्कॉलरशिप|विद्यार्थी|छात्र", "education scholarship student"],
  ["ghar|makan|awas|aawas|house|housing", "घर|मकान|आवास", "housing house home"],
  ["ilaj|ilaaj|bimari|aspatal|hospital|swasthya|bima|insurance|dawa|treatment", "इलाज|बीमारी|अस्पताल|स्वास्थ्य|बीमा|दवा", "health insurance medical treatment"],
  ["shadi|shaadi|vivah|marriage", "शादी|विवाह", "marriage"],
  ["pension|budhapa|bujurg|vridh|senior", "पेंशन|बुजुर्ग|वृद्ध|बुढ़ापा", "pension old age senior citizen"],
  ["viklang|divyang|apang|disabled|disability", "विकलांग|दिव्यांग|अपंग", "disability disabled divyang"],
  ["naukri|rozgar|rojgar|kaam|job|employment", "नौकरी|रोजगार|रोज़गार|काम", "employment job"],
  ["training|prashikshan|skill|kaushal|hunar", "प्रशिक्षण|ट्रेनिंग|कौशल|हुनर", "skill training"],
  ["gaay|gai|bhains|bakri|pashu|dairy|doodh|murgi|poultry", "गाय|भैंस|बकरी|पशु|डेयरी|दूध|मुर्गी", "dairy livestock animal husbandry poultry"],
  ["silai|sewing|tailor|tailoring", "सिलाई|कढ़ाई|दर्जी", "tailoring sewing women"],
  ["bijli|solar", "बिजली|सोलर", "solar electricity"],
  ["mahila|aurat|women|woman", "महिला|औरत|स्त्री", "women"],
  ["beti|ladki|kanya|girl", "बेटी|लड़की|कन्या", "girl child women"],
  ["subsidy|anudan|sabsidi|madad|sahayata|grant", "सब्सिडी|अनुदान|सहायता|मदद", "subsidy grant assistance"],
  ["gaadi|gadi|vehicle|tractor|rickshaw|auto|truck", "ट्रैक्टर|गाड़ी|रिक्शा|ऑटो|ट्रक", "vehicle loan transport"],
  ["machine|machinery|equipment|upkaran", "मशीन|उपकरण", "equipment machinery"],
  ["pani|water|borewell|nalkoop", "पानी|नलकूप", "water irrigation"]
].map(([latin, dev, kw]) => ({
  re: new RegExp("\\b(?:" + latin + ")\\b|" + nfc(dev), "i"),
  kw
}));

/* "mujhe dukan ke liye loan chahiye" -> { text: "... loan credit business enterprise ...", keywords: [...] } */
function expandNeed(text) {
  const raw = String(text || "").trim();
  const t = nfc(raw);
  const words = [];
  LEXICON.forEach(e => { if (e.re.test(t)) words.push(...e.kw.split(" ")); });
  const keywords = [...new Set(words)];
  return { text: keywords.length ? raw + " " + keywords.join(" ") : raw, keywords };
}

module.exports = { expandNeed };