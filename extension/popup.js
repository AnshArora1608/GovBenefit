// GovBenefit Form Mentor - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const profileNameEl = document.getElementById('profileName');
  const profileMetaEl = document.getElementById('profileMeta');
  const statusBadge = document.getElementById('statusBadge');

  try {
    const res = await fetch('http://localhost:8000/api/mentor/profile');
    if (!res.ok) throw new Error('Status ' + res.status);
    const data = await res.json();

    if (data.user && data.user.personal) {
      profileNameEl.textContent =
        data.user.personal.fullName || 'Registered Citizen';
      const state = data.user.contact ? data.user.contact.state : '';
      const cat = data.user.demographics
        ? data.user.demographics.socialCat
        : '';
      profileMetaEl.textContent = `${state ? state + ' • ' : ''}${cat || 'General'}`;
    } else {
      profileNameEl.textContent = 'No saved profile found';
      profileMetaEl.textContent =
        "Click 'Edit GovBenefit Profile' to save your details.";
    }
  } catch (err) {
    statusBadge.textContent = '○ Server Offline (localhost:8000)';
    statusBadge.style.background = '#fee2e2';
    statusBadge.style.color = '#991b1b';
    profileNameEl.textContent = 'Could not reach GovBenefit';
    profileMetaEl.textContent = 'Start the server with npm start';
  }
});
