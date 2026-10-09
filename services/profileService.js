const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getProfilesData() {
  ensureDataDir();
  if (!fs.existsSync(PROFILES_FILE)) {
    // Fallback check for profile.json if profiles.json doesn't exist
    if (fs.existsSync(PROFILE_FILE)) {
      try {
        const single = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
        return {
          user: single.user || single,
          applications: single.applications || [],
          lastUpdated: single.lastUpdated || new Date().toISOString(),
        };
      } catch (err) {
        console.error('Error reading profile.json:', err);
      }
    }
    return {
      user: null,
      applications: [],
      lastUpdated: null,
    };
  }

  try {
    const raw = fs.readFileSync(PROFILES_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      user: data.user || null,
      applications: Array.isArray(data.applications) ? data.applications : [],
      lastUpdated: data.lastUpdated || null,
    };
  } catch (err) {
    console.error('Error reading profiles.json:', err);
    return {
      user: null,
      applications: [],
      lastUpdated: null,
    };
  }
}

function saveProfileData(formData) {
  ensureDataDir();
  const existing = getProfilesData();

  const now = new Date().toISOString();

  const userProfile = {
    id:
      existing.user && existing.user.id
        ? existing.user.id
        : `usr_${Date.now()}`,
    updatedAt: now,
    personal: {
      fullName: String(formData.full_name || '').trim(),
      guardianName: String(formData.guardian_name || '').trim(),
      dob: String(formData.dob || '').trim(),
      age:
        Number(formData.age) ||
        (existing.user && existing.user.personal
          ? existing.user.personal.age
          : 0),
      gender: String(formData.gender || '').trim(),
      maritalStatus: String(formData.marital_status || '').trim(),
    },
    contact: {
      mobile: String(formData.mobile || '').trim(),
      email: String(formData.email || '').trim(),
      state: String(formData.state || '').trim(),
      district: String(formData.district || '').trim(),
      cityVillage: String(formData.city_village || '').trim(),
      pincode: String(formData.pincode || '').trim(),
      address: String(formData.address || '').trim(),
      areaType: String(formData.area_type || '').trim(),
    },
    demographics: {
      socialCat: String(formData.social_cat || '').trim(),
      minority: formData.minority === 'true' || formData.minority === true,
      minorityCommunity: String(formData.minority_community || '').trim(),
      disability:
        formData.disability === 'true' || formData.disability === true,
      disabilityType: String(formData.disability_type || '').trim(),
      disabilityPct: Number(formData.disability_pct) || null,
      bpl: formData.bpl === 'true' || formData.bpl === true,
      rationCardNo: String(formData.ration_card_no || '').trim(),
    },
    educationOccupation: {
      education: String(formData.education || '').trim(),
      occupation: String(formData.occupation || '').trim(),
      income: Number(formData.income) || 0,
      incomeCertNo: String(formData.income_cert_no || '').trim(),
    },
    bankIdentity: {
      aadhaarNo: String(formData.aadhaar_no || '').trim(),
      panNo: String(formData.pan_no || '')
        .trim()
        .toUpperCase(),
      bankName: String(formData.bank_name || '').trim(),
      accountNo: String(formData.account_no || '').trim(),
      ifscCode: String(formData.ifsc_code || '')
        .trim()
        .toUpperCase(),
      accountHolderName: String(formData.account_holder_name || '').trim(),
    },
  };

  const applications = existing.applications.slice();

  // If an application for a specific scheme is associated with this submission
  if (formData.scheme_name && formData.scheme_name.trim()) {
    const schemeName = formData.scheme_name.trim();
    const schemeUrl = String(formData.scheme_url || '').trim();

    const existingAppIndex = applications.findIndex(
      (app) => app.scheme_name.toLowerCase() === schemeName.toLowerCase()
    );

    const appRecord = {
      id:
        existingAppIndex >= 0
          ? applications[existingAppIndex].id
          : `app_${Date.now()}`,
      scheme_name: schemeName,
      scheme_url: schemeUrl,
      status: 'Profile Saved - Ready to Apply',
      appliedAt: now,
    };

    if (existingAppIndex >= 0) {
      applications[existingAppIndex] = appRecord;
    } else {
      applications.unshift(appRecord);
    }
  }

  const payload = {
    lastUpdated: now,
    user: userProfile,
    applications,
  };

  // Save to profiles.json (complete collection)
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(payload, null, 2), 'utf8');

  // Also mirror to profile.json for quick single-profile reference
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(payload, null, 2), 'utf8');

  return payload;
}

module.exports = {
  getProfilesData,
  saveProfileData,
};
