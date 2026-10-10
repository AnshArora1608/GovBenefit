const { getProfilesData } = require('./profileService');

/**
 * Normalizes text for comparison by removing accents, special characters, and extra spaces.
 */
function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Accesses a nested property in an object safely using dot-notation.
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Canonical dictionary mapping typical field aliases and keywords to user profile keys.
 */
const CANONICAL_MAPPINGS = [
  {
    fieldKey: 'applicant_name',
    profilePath: 'personal.fullName',
    aliases: [
      'applicantname',
      'fullname',
      'name',
      'candidatename',
      'beneficiaryname',
    ],
    labelKeywords: [
      'name of applicant',
      'applicant name',
      'full name',
      'आवेदक का नाम',
      'पूरा नाम',
    ],
  },
  {
    fieldKey: 'guardian_name',
    profilePath: 'personal.guardianName',
    aliases: [
      'guardianname',
      'fathername',
      'husbandname',
      'fatherorhusbandname',
    ],
    labelKeywords: ['father', 'husband', 'guardian', 'पिता', 'पति', 'अभिभावक'],
  },
  {
    fieldKey: 'dob',
    profilePath: 'personal.dob',
    aliases: ['dob', 'dateofbirth', 'birthdate'],
    labelKeywords: [
      'date of birth',
      'dob',
      'birth date',
      'जन्म तिथि',
      'जन्मतिथि',
    ],
  },
  {
    fieldKey: 'gender',
    profilePath: 'personal.gender',
    aliases: ['gender', 'sex'],
    labelKeywords: ['gender', 'sex', 'लिंग'],
  },
  {
    fieldKey: 'mobile_no',
    profilePath: 'contact.mobile',
    aliases: [
      'mobile',
      'mobileno',
      'phone',
      'phoneno',
      'contactno',
      'cellphone',
    ],
    labelKeywords: ['mobile', 'phone', 'contact number', 'मोबाइल', 'फ़ोन'],
  },
  {
    fieldKey: 'email',
    profilePath: 'contact.email',
    aliases: ['email', 'emailid', 'emailaddress'],
    labelKeywords: ['email', 'e-mail', 'ईमेल'],
  },
  {
    fieldKey: 'state',
    profilePath: 'contact.state',
    aliases: ['state', 'statename', 'statecode'],
    labelKeywords: ['state', 'state/ut', 'राज्य'],
  },
  {
    fieldKey: 'district',
    profilePath: 'contact.district',
    aliases: ['district', 'districtname'],
    labelKeywords: ['district', 'जिला'],
  },
  {
    fieldKey: 'pincode',
    profilePath: 'contact.pincode',
    aliases: ['pincode', 'postalcode', 'zip', 'zipcode'],
    labelKeywords: ['pin code', 'pincode', 'postal code', 'पिन कोड', 'पिनकोड'],
  },
  {
    fieldKey: 'comm_address',
    profilePath: 'contact.address',
    aliases: [
      'address',
      'commaddress',
      'postaladdress',
      'residentialaddress',
      'permanentaddress',
    ],
    labelKeywords: [
      'communication address',
      'postal address',
      'residential address',
      'address',
      'पता',
      'निवास का पता',
    ],
  },
  {
    fieldKey: 'social_cat',
    profilePath: 'demographics.socialCat',
    aliases: [
      'socialcat',
      'socialcategory',
      'caste',
      'castecategory',
      'community',
    ],
    labelKeywords: [
      'social category',
      'caste category',
      'category',
      'सामाजिक श्रेणी',
      'जाति श्रेणी',
    ],
  },
  {
    fieldKey: 'education',
    profilePath: 'educationOccupation.education',
    aliases: [
      'qualification',
      'education',
      'academicqualification',
      'highesteducation',
    ],
    labelKeywords: [
      'academic qualification',
      'qualification',
      'education',
      'शैक्षणिक योग्यता',
      'शिक्षा',
    ],
  },
  {
    fieldKey: 'occupation',
    profilePath: 'educationOccupation.occupation',
    aliases: ['occupation', 'employmentstatus', 'profession'],
    labelKeywords: [
      'occupation',
      'employment',
      'profession',
      'व्यवसाय',
      'रोजगार',
    ],
  },
  {
    fieldKey: 'income',
    profilePath: 'educationOccupation.income',
    aliases: ['income', 'annualincome', 'familyincome', 'annualfamilyincome'],
    labelKeywords: [
      'annual family income',
      'annual income',
      'family income',
      'वार्षिक आय',
      'पारिवारिक आय',
    ],
  },
  {
    fieldKey: 'aadhaar_no',
    profilePath: 'bankIdentity.aadhaarNo',
    aliases: ['aadhaarno', 'aadhaar', 'uid', 'aadharnumber', 'aadharno'],
    labelKeywords: ['aadhaar', 'aadhar', 'uid', 'आधार संख्या', 'आधार'],
  },
  {
    fieldKey: 'pan_no',
    profilePath: 'bankIdentity.panNo',
    aliases: ['panno', 'pan', 'pannumber'],
    labelKeywords: ['pan card', 'pan number', 'pan no', 'पैन कार्ड', 'पैन'],
  },
  {
    fieldKey: 'bank_account_no',
    profilePath: 'bankIdentity.accountNo',
    aliases: ['accountno', 'bankaccountno', 'bankaccount', 'accountnumber'],
    labelKeywords: [
      'account number',
      'bank account',
      'savings account',
      'खाता संख्या',
      'बैंक खाता',
    ],
  },
  {
    fieldKey: 'ifsc_code',
    profilePath: 'bankIdentity.ifscCode',
    aliases: ['ifsccode', 'ifsc', 'branchifsc'],
    labelKeywords: ['ifsc code', 'ifsc', 'आईएफएससी कोड'],
  },
  {
    fieldKey: 'bank_name',
    profilePath: 'bankIdentity.bankName',
    aliases: ['bankname', 'bank'],
    labelKeywords: ['bank name', 'name of bank', 'बैंक का नाम'],
  },
];

/**
 * Matches a form field from the DOM against the user's GovBenefit profile.
 *
 * @param {Object} fieldInfo Information collected about the field from DOM
 *   - id: string
 *   - name: string
 *   - type: string (text, select, radio, checkbox, date, etc.)
 *   - labelText: string
 *   - placeholder: string
 *   - options: Array<{ value, label }> (if select)
 * @returns {Object} Match resolution
 */
function matchFieldToProfile(fieldInfo) {
  const data = getProfilesData();
  const user = data.user;

  if (!user) {
    return {
      matched: false,
      reason:
        'No saved GovBenefit profile found. Please create or save a profile first.',
    };
  }

  const testId = normalize(fieldInfo.id);
  const testName = normalize(fieldInfo.name);
  const testLabel = (fieldInfo.labelText || '').toLowerCase();
  const testPlaceholder = (fieldInfo.placeholder || '').toLowerCase();

  let bestMapping = null;
  let confidence = 0;

  for (const mapping of CANONICAL_MAPPINGS) {
    // Exact name or ID alias match (highest confidence)
    if (mapping.aliases.some((a) => testName === a || testId === a)) {
      bestMapping = mapping;
      confidence = 0.98;
      break;
    }

    // Substring ID / Name match
    if (
      mapping.aliases.some((a) => testName.includes(a) || testId.includes(a))
    ) {
      bestMapping = mapping;
      confidence = 0.85;
      break;
    }

    // Label keyword match
    if (
      mapping.labelKeywords.some(
        (kw) => testLabel.includes(kw) || testPlaceholder.includes(kw)
      )
    ) {
      bestMapping = mapping;
      confidence = 0.75;
      break;
    }
  }

  if (!bestMapping) {
    return {
      matched: false,
      confidence: 0,
    };
  }

  const rawValue = getNestedValue(user, bestMapping.profilePath);
  if (rawValue == null || rawValue === '') {
    return {
      matched: true,
      fieldKey: bestMapping.fieldKey,
      profilePath: bestMapping.profilePath,
      savedValue: null,
      displayValue: '(Not provided in saved profile)',
      confidence,
      requiresConfirmation: true,
    };
  }

  let resolvedValue = rawValue;
  let displayValue = String(rawValue);

  // If target field is a dropdown (<select>), match against options
  if (fieldInfo.type === 'select-one' || Array.isArray(fieldInfo.options)) {
    const options = fieldInfo.options || [];
    const normVal = normalize(rawValue);

    const matchedOpt = options.find((opt) => {
      const optVal = normalize(opt.value);
      const optText = normalize(opt.label || opt.text);
      return (
        optVal === normVal ||
        optText === normVal ||
        optText.includes(normVal) ||
        normVal.includes(optVal)
      );
    });

    if (matchedOpt) {
      resolvedValue = matchedOpt.value;
      displayValue = matchedOpt.label || matchedOpt.text || matchedOpt.value;
    }
  }

  return {
    matched: true,
    fieldKey: bestMapping.fieldKey,
    profilePath: bestMapping.profilePath,
    savedValue: resolvedValue,
    displayValue,
    confidence,
    requiresConfirmation: true,
  };
}

module.exports = {
  matchFieldToProfile,
  CANONICAL_MAPPINGS,
};
