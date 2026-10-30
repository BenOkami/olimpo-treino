// Peso, medidas e fotos de evolução corporal.
import { S, put, del } from '../store.js';
import { todayISO, fmtDate, fmtDateFull, fmtNum, num, esc, toast } from '../util.js';
import { $, $$, field, chips, bindChips } from '../ui.js';
import { MEASURES, POSES } from '../defaults.js';

let cmpA = null, cmpB = null, pose = 'frente';

function resize(file, max = 1000) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

export function render(el, p) {
  const date = p.data || todayISO();
  const rec = S.body.find(b => b.date === date) || { date, measures: {}, photos: {} };
  const photos = { ...(rec.photos || {}) };
  const withPhotos = S.body.filter(b => b.photos && Object.values(b.photos).some(Boolean));
  if (!cmpA || !withPhotos.some(b => b.id === cmpA)) cmpA = withPhotos[0]?.id;
  if (!cmpB || !withPhotos.some(b => b.id === cmpB)) cmpB = withPhotos.at(-1)?.id;
  const A = withPhotos.find(b => b.id === cmpA), B = withPhotos.find(b => b.id === cmpB);

  el.innerHTML = `
    <section class="card">
      <h2>Registro corporal</h2>
      <div class="grid2">
        ${field('Data', `<input type="date" id="b-date" value="${date}">`)}
        ${field('Peso (kg)', `<input type="number" inputmode="decimal" step="0.1" id="b-w" value="${rec.weight ?? ''}">`)}
        ${field('% de gordura (opcional)', `<input type="number" inputmode="decimal" step="0.1" id="b-bf" value="${rec.bodyFat ?? ''}">`)}
      </div>
      <h3>Medidas (cm)</h3>
      <div class="grid3">${MEASURES.map(([k, l]) => field(l, `<input type="number" inputmode="decimal" step="0.1" data-m="${k}" value="${rec.measures?.[k] ?? ''}">`)).join('')}</div>
      <h3>Fotos</h3>
      <div class="grid3">${POSES.map(([k, l]) => `<label class="photo-slot">${photos[k] ? `<img src="${photos[k]}" alt="${l}">` : `<span>+ ${l}</span>`}
        <input type="file" accept="image/*" data-photo="${k}" hidden></label>`).join('')}</div>
      <p class="small muted">As fotos ficam salvas somente neste aparelho.</p>
      <div class="row gap top">${rec.id ? '<button class="btn danger" id="b-del">Excluir</button>' : ''}<button class="btn grow" id="b-save">Salvar</button></div>
    </section>

    <section class="card">
      <h2>Evolução por fotos</h2>
      ${withPhotos.length ? `
        ${chips('pose', POSES, pose)}
        <div class="grid2 top">
          <select id="c-a">${withPhotos.map(b => `<option value="${b.id}" ${b.id === cmpA ? 'selected' : ''}>${fmtDateFull(b.date)}</option>`).join('')}</select>
          <select id="c-b">${withPhotos.map(b => `<option value="${b.id}" ${b.id === cmpB ? 'selected' : ''}>${fmtDateFull(b.date)}</option>`).join('')}</select>
        </div>
        <div class="photo-cmp top">
          ${[A, B].map(x => `<figure>${x?.photos?.[pose] ? `<img src="${x.photos[pose]}" alt="">` : '<div class="ph-empty">Sem foto nesta pose</div>'}
            <figcaption>${fmtDate(x?.date)}${x?.weight ? ' · ' + fmtNum(x.weight) + ' kg' : ''}</figcaption></figure>`).join('')}
        </div>` : '<p class="muted">Adicione fotos para comparar a evolução corporal.</p>'}
    </section>

    <section class="card">
      <h2>Histórico</h2>
      ${S.body.length ? `<table><thead><tr><th>Data</th><th>Peso</th><th>Cintura</th><th>Fotos</th></tr></thead><tbody>
        ${S.body.slice().reverse().map(b => `<tr data-go="${b.date}"><td><a href="#/corpo?data=${b.date}">${fmtDate(b.date)}</a></td><td>${b.weight ? fmtNum(b.weight) : '–'}</td><td>${b.measures?.cintura ? fmtNum(b.measures.cintura) : '–'}</td><td>${Object.values(b.photos || {}).filter(Boolean).length || ''}</td></tr>`).join('')}</tbody></table>`
        : '<p class="muted">Nenhum registro ainda.</p>'}
    </section>`;

  $$('[data-photo]', el).forEach(inp => inp.onchange = async () => {
    const f = inp.files[0];
    if (!f) return;
    photos[inp.dataset.photo] = await resize(f);
    const slot = inp.closest('.photo-slot');
    slot.querySelector('img, span')?.remove();
    slot.insertAdjacentHTML('afterbegin', `<img src="${photos[inp.dataset.photo]}" alt="">`);
  });
  $('#b-date', el).onchange = e => { location.hash = '#/corpo?data=' + e.target.value; };
  $('#b-save', el).onclick = async () => {
    const measures = {};
    $$('[data-m]', el).forEach(i => { const v = num(i.value); if (v != null) measures[i.dataset.m] = v; });
    const obj = { ...rec, date: $('#b-date', el).value || date, weight: num($('#b-w', el).value), bodyFat: num($('#b-bf', el).value), measures, photos };
    await put('body', obj);
    toast('Registro corporal salvo');
    render(el, { data: obj.date });
  };
  $('#b-del', el)?.addEventListener('click', async () => {
    if (!confirm('Excluir este registro (incluindo fotos)?')) return;
    await del('body', rec.id); render(el, {});
  });
  bindChips(el, (n, v) => { pose = v; render(el, p); });
  $('#c-a', el)?.addEventListener('change', e => { cmpA = e.target.value; render(el, p); });
  $('#c-b', el)?.addEventListener('change', e => { cmpB = e.target.value; render(el, p); });
}
