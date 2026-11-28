const SURVEY_API_URL = "https://script.google.com/macros/s/AKfycbzx_6Jn7SNXxvEe4qJICPrAvd9XFYzNU6PKDGn-N258aXqzkkNKRL_tuDv4pyfW0YU/exec";

(() => {
  const form = document.getElementById('lecturerSurveyForm');
  if (!form) return;
  const error = document.getElementById('lecturerError');
  const button = document.getElementById('lecturerSubmit');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form).entries());
    ['bentuk_promosi', 'media_promosi', 'dukungan'].forEach(name => {
      data[name] = [...form.querySelectorAll('input[name="' + name + '"]:checked')].map(input => input.value);
    });
    data.survey_type = 'dosen_pmb';
    data.consent = form.querySelector('[name="consent"]').checked;
    data.submitted_at = new Date().toISOString();

    button.disabled = true;
    button.textContent = 'Mengirim...';
    error.textContent = '';

    try {
      await fetch(SURVEY_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: JSON.stringify(data)
      });
      form.classList.add('hidden');
      document.getElementById('lecturerSuccess').classList.remove('hidden');
    } catch (err) {
      console.error(err);
      error.textContent = 'Pengiriman gagal. Periksa koneksi internet lalu coba kembali.';
      button.disabled = false;
      button.innerHTML = 'Kirim survei dosen <span>↗</span>';
    }
  });
})();
