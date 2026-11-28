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


// Dashboard hasil survei dosen: membaca agregat JSONP dari Apps Script.
(() => {
  const root = document.getElementById('hasil-dosen');
  if (!root) return;
  const status = document.getElementById('lecturerResultsStatus');
  const api = SURVEY_API_URL;
  let callbackReceived = false;
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = Number(value || 0).toLocaleString('id-ID');
  };
  const count = (items, matcher) => (items || []).filter(x => matcher(String(x.label || ''))).reduce((n, x) => n + Number(x.count || 0), 0);
  const charts = [];
  function draw(id, items, type = 'bar') {
    const canvas = document.getElementById(id);
    const card = canvas?.closest('.result-chart');
    const rows = Array.isArray(items) ? items.filter(x => Number(x.count) > 0) : [];
    if (!canvas || !card || !rows.length || !window.Chart) return;
    card.classList.add('has-data');
    charts.push(new Chart(canvas, {
      type: type === 'doughnut' ? 'doughnut' : 'bar',
      data: {
        labels: rows.map(x => x.label),
        datasets: [{ data: rows.map(x => Number(x.count)), backgroundColor: ['#2478bd','#28b9b0','#f28c28','#12345b','#55b9e8','#79a8cf','#80cfc5','#dca45d'], borderWidth: 0, borderRadius: 6, maxBarThickness: 28 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: type === 'bar' ? 'y' : 'x',
        plugins: { legend: { display: type === 'doughnut', position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } }, tooltip: { callbacks: { label: ctx => ctx.label + ': ' + (ctx.parsed.x ?? ctx.parsed) + ' dosen' } } },
        scales: type === 'doughnut' ? {} : { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } }
      }
    }));
  }
  window.fstLecturerSummary = payload => {
    callbackReceived = true;
    if (!payload || payload.ok === false || !payload.lecturer) {
      status.textContent = 'Apps Script merespons, tetapi ringkasan survei dosen tidak ditemukan. Perbarui deployment dengan Code.gs terbaru.';
      console.error('Invalid lecturer summary payload:', payload);
      return;
    }
    const lecturer = payload.lecturer;
    const total = Number(lecturer.totalResponses || 0);
    set('lecturerKpiTotal', total);
    set('lecturerKpiInvolved', count(lecturer.involvement, x => /^ya$/i.test(x)));
    set('lecturerKpiWilling', count(lecturer.willingness, x => /^(sangat bersedia|bersedia)$/i.test(x)));
    set('lecturerKpiPrograms', (lecturer.programs || []).length);
    status.textContent = total
      ? 'Data survei dosen berhasil dimuat · ' + total.toLocaleString('id-ID') + ' responden'
      : 'Ringkasan berhasil dimuat, tetapi tab Survei Dosen PMB belum memiliki respons. Pastikan jawaban sudah tercatat di Google Sheets.';
    draw('lecturerChartInvolvement', lecturer.involvement);
    draw('lecturerChartFrequency', lecturer.frequency);
    draw('lecturerChartActivities', lecturer.activities);
    draw('lecturerChartMedia', lecturer.media, 'doughnut');
    draw('lecturerChartObstacles', lecturer.obstacles);
    draw('lecturerChartSupport', lecturer.support);
    draw('lecturerChartWillingness', lecturer.willingness);
    draw('lecturerChartPrograms', lecturer.programs, 'doughnut');
  };
  const script = document.createElement('script');
  script.src = api + '?callback=fstLecturerSummary&t=' + Date.now();
  script.onerror = () => {
    status.textContent = 'Gagal mengakses Apps Script. Periksa URL deployment dan setelan akses Web App: Anyone.';
  };
  script.onload = () => {
    window.setTimeout(() => {
      if (!callbackReceived) status.textContent = 'Apps Script terbuka, tetapi callback ringkasan tidak dijalankan. Kemungkinan deployment masih memakai versi Code.gs lama. Deploy ulang sebagai versi baru.';
    }, 700);
  };
  document.head.appendChild(script);
})();
