const {
  getProfilesData,
  saveProfileData,
} = require('../services/profileService');

const INDIAN_STATES = [
  'All India (Central)',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

const showProfilePage = (req, res) => {
  const existing = getProfilesData();
  const q = req.query || {};

  // Merge URL query params (from recommendations search) with previously saved profile
  const savedUser = existing.user || {};
  const personal = savedUser.personal || {};
  const contact = savedUser.contact || {};
  const demographics = savedUser.demographics || {};
  const educationOccupation = savedUser.educationOccupation || {};
  const bankIdentity = savedUser.bankIdentity || {};

  const profile = {
    // Personal
    fullName: personal.fullName || '',
    guardianName: personal.guardianName || '',
    dob: personal.dob || '',
    age: q.age !== undefined && q.age !== '' ? q.age : personal.age || '',
    gender: q.gender || personal.gender || '',
    maritalStatus: personal.maritalStatus || '',

    // Contact & Address
    mobile: contact.mobile || '',
    email: contact.email || '',
    state: q.state || contact.state || '',
    district: contact.district || '',
    cityVillage: contact.cityVillage || '',
    pincode: contact.pincode || '',
    address: contact.address || '',
    areaType: contact.areaType || 'Rural',

    // Demographics
    socialCat: q.social_cat || demographics.socialCat || 'General',
    minority:
      q.minority !== undefined
        ? q.minority === 'true' || q.minority === true
        : Boolean(demographics.minority),
    minorityCommunity: demographics.minorityCommunity || '',
    disability:
      q.disability !== undefined
        ? q.disability === 'true' || q.disability === true
        : Boolean(demographics.disability),
    disabilityType: demographics.disabilityType || '',
    disabilityPct: demographics.disabilityPct || '',
    bpl:
      q.bpl !== undefined
        ? q.bpl === 'true' || q.bpl === true
        : Boolean(demographics.bpl),
    rationCardNo: demographics.rationCardNo || '',

    // Education & Occupation
    education: educationOccupation.education || '',
    occupation: educationOccupation.occupation || '',
    income:
      q.income !== undefined && q.income !== ''
        ? q.income
        : educationOccupation.income || '',
    incomeCertNo: educationOccupation.incomeCertNo || '',

    // Bank & ID
    aadhaarNo: bankIdentity.aadhaarNo || '',
    panNo: bankIdentity.panNo || '',
    bankName: bankIdentity.bankName || '',
    accountNo: bankIdentity.accountNo || '',
    ifscCode: bankIdentity.ifscCode || '',
    accountHolderName:
      bankIdentity.accountHolderName || personal.fullName || '',
  };

  const scheme = {
    name: q.scheme_name || '',
    url: q.scheme_url || '',
  };

  res.render('profile', {
    profile,
    scheme,
    states: INDIAN_STATES,
  });
};

const saveProfileController = (req, res) => {
  try {
    saveProfileData(req.body);
    return res.redirect('/dashboard');
  } catch (err) {
    console.error('Error saving profile:', err);
    return res.status(500).render('profile', {
      profile: req.body,
      scheme: {
        name: req.body.scheme_name || '',
        url: req.body.scheme_url || '',
      },
      states: INDIAN_STATES,
      error: 'Failed to save profile details. Please try again.',
    });
  }
};

const showDashboardPage = (req, res) => {
  const data = getProfilesData();
  res.render('dashboard', {
    user: data.user,
    applications: data.applications,
    lastUpdated: data.lastUpdated,
  });
};

const exportProfileJson = (req, res) => {
  const data = getProfilesData();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="my_govbenefit_profile.json"'
  );
  res.send(JSON.stringify(data, null, 2));
};

module.exports = {
  showProfilePage,
  saveProfileController,
  showDashboardPage,
  exportProfileJson,
};
