// Instagram feed for FST UIBU. The API token stays on Google Apps Script.
(() => {
  const endpoint = 'https://script.google.com/macros/s/AKfycbwnIU5q50Oc8Aem3NoDwnCkG3i4cgzcmcXIIMEpFSfKkCzQCLV9qXM3XUCbFRuFu44M/exec';
  const root = document.getElementById('instagramFeed');
  const filters = document.getElementById('instagramAccounts');
  const updated = document.getElementById('instagramUpdated');
  if (!root || !filters || !endpoint) return;

  let feed = [];
  let active = 'all';
  const accountNames = {
    mesin: 'Teknik Mesin UIBU',
    elektro: 'Teknik Elektro UIBU',
    kimia: 'Teknik Kimia UIBU',
    fst: 'FST UIBU Official'
  };

  const message = (title, note) => {
    const box = document.createElement('article');
    box.className = 'instagram-message';
    const heading = document.createElement('b');
    heading.textContent = title;
    const detail = document.createElement('small');
    detail.textContent = note;
    box.append(heading, detail);
    root.replaceChildren(box);
  };

  function render() {
    const accounts = active === 'all' ? feed : feed.filter(a => a.key === active);
    const posts = accounts.flatMap(account => (account.items || []).map(item => ({...item, account})))
      .sort((a,b) => Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0));

    if (!posts.length) {
      const configured = feed.filter(a => a.configured);
      const errors = configured.map(a => a.error).filter(Boolean);
      if (!configured.length) {
        message('Akun Instagram belum diotorisasi', 'Admin perlu menghubungkan keempat akun melalui Meta Instagram API dan menyimpan token di Script Properties Apps Script.');
      } else if (errors.length) {
        message('Feed Instagram belum dapat dimuat', errors[0] + ' · Periksa izin instagram_business_basic dan token akun.');
      } else {
        message('Belum ada postingan yang dapat ditampilkan', 'Pastikan akun memiliki konten publik yang dapat diakses API.');
      }
      return;
    }

    const fragment = document.createDocumentFragment();
    posts.slice(0, 16).forEach(post => {
      const card = document.createElement('article');
      card.className = 'instagram-card';
      const link = document.createElement('a');
      link.className = 'instagram-media';
      link.href = post.permalink;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const image = document.createElement('img');
      image.src = post.mediaUrl;
      image.alt = 'Postingan Instagram ' + post.account.username;
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => {
        image.removeAttribute('src');
        image.alt = 'Media tidak dapat dimuat. Buka postingan di Instagram.';
      });
      const type = document.createElement('span');
      type.className = 'instagram-media-type';
      type.textContent = post.mediaType === 'VIDEO' ? 'REEL / VIDEO' : post.mediaType === 'CAROUSEL_ALBUM' ? 'CAROUSEL' : 'FOTO';
      link.append(image, type);

      const body = document.createElement('div');
      body.className = 'instagram-card-body';
      const user = document.createElement('div');
      user.className = 'instagram-user';
      user.textContent = '@' + post.account.username + ' · ' + (accountNames[post.account.key] || 'FST UIBU');
      const caption = document.createElement('p');
      caption.className = 'instagram-caption';
      caption.textContent = post.caption || 'Lihat dokumentasi terbaru dari akun Instagram resmi.';
      const open = document.createElement('a');
      open.href = post.permalink;
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      open.textContent = 'Lihat di Instagram ↗';
      body.append(user, caption, open);
      card.append(link, body);
      fragment.append(card);
    });
    root.replaceChildren(fragment);
  }

  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-account]');
    if (!button) return;
    active = button.dataset.account;
    filters.querySelectorAll('[data-account]').forEach(item => {
      const selected = item === button;
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    render();
  });

  function loadFeed() {
    const callbackName = 'fstInstagramFeedCallback';
    window[callbackName] = data => {
      if (!data || !Array.isArray(data.accounts)) {
        message('Respons Instagram tidak valid', 'Periksa endpoint Apps Script dan konfigurasi feed.');
        return;
      }
      feed = data.accounts;
      render();
      const ready = feed.filter(a => a.configured && !a.error).length;
      updated.textContent = 'Feed diperbarui ' + new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) + ' · ' + ready + '/4 akun terhubung · pembaruan tiap 15 menit.';
    };
    const script = document.createElement('script');
    script.src = endpoint + '?action=instagramFeed&callback=' + callbackName + '&t=' + Date.now();
    script.onerror = () => message('Server feed Instagram tidak merespons', 'Pastikan Web App Apps Script sudah diperbarui ke versi terbaru dan aksesnya disetel Anyone.');
    document.head.appendChild(script);
    script.onload = () => script.remove();
  }

  loadFeed();
  window.setInterval(loadFeed, 15 * 60 * 1000);
})();