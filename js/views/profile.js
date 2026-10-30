// Perfil (nível, objetivo), backup dos dados e menu "Mais".
import { S, setKV, exportAll, importAll, wipe } from '../store.js';
import { todayISO, num, esc, toast } from '../util.js';
import { $, chips, bindChips, chipVal, field, icon } from '../ui.js';
import { GOALS, LEVELS } from '../defaults.js';
import { APP_VERSION, checkForUpdate, forceUpdate } from '../updater.js';
import * as cloud from '../cloud.js';
import * as strava from '../strava.js';

// Seção "Strava": conectar, preferências de envio automático e importação
function stravaCard(box) {
  const draw = (msg = '') => {
    if (!box.isConnected) return;
    const logged = !!cloud.status().user;
    const st = strava.cachedStatus();
    const p = strava.prefs();
    if (!logged) {
      box.innerHTML = `<h2><span class="strava-mark">S</span> Strava</h2><p class="small muted">Entre na sua conta da nuvem (acima) para conectar o Strava.</p>`;
      return;
    }
    if (!st?.connected) {
      box.innerHTML = `<h2><span class="strava-mark">S</span> Strava</h2>
        <p class="small muted">Conecte para enviar suas corridas automaticamente ao Strava (com o trajeto do GPS) e trazer para o app as corridas feitas no relógio ou no Strava.</p>
        <button class="btn strava block" id="s-connect">Conectar com o Strava</button>
        <p class="small muted" id="s-msg">${esc(msg)}</p>`;
      $('#s-connect', box).onclick = async () => {
        $('#s-msg', box).textContent = 'Abrindo o Strava…';
        try { await strava.connect(); } catch (e) { $('#s-msg', box).textContent = e.message; }
      };
      return;
    }
    const name = [st.athlete?.firstname, st.athlete?.lastname].filter(Boolean).join(' ');
    box.innerHTML = `<h2><span class="strava-mark">S</span> Strava</h2>
      <p class="small">✓ Conectado${name ? ` como <b>${esc(name)}</b>` : ''}</p>
      <div class="field"><span>Enviar automaticamente ao Strava</span>${chips('s-auto', [['runs', 'Corridas'], ['cardio', 'Cardio'], ['strength', 'Musculação']], Object.keys(p).filter(k => p[k]), true)}</div>
      <div class="row gap"><button class="btn secondary grow" id="s-import">Importar corridas do Strava</button><button class="btn secondary grow" id="s-off">Desconectar</button></div>
      <p class="small muted" id="s-msg">${esc(msg)}</p>`;
    bindChips(box, (n, v) => { if (n === 's-auto') strava.setPrefs({ runs: v.includes('runs'), cardio: v.includes('cardio'), strength: v.includes('strength') }); });
    $('#s-import', box).onclick = async () => {
      $('#s-msg', box).textContent = 'Buscando corridas no Strava…';
      try { const n = await strava.importRuns(); draw(n ? `${n} corrida(s) importada(s). Veja em Corridas.` : 'Nenhuma corrida nova no Strava.'); }
      catch (e) { $('#s-msg', box).textContent = e.message; }
    };
    $('#s-off', box).onclick = async () => {
      if (!confirm('Desconectar o Strava? As atividades já enviadas continuam no Strava.')) return;
      try { await strava.disconnect(); draw('Strava desconectado.'); } catch (e) { $('#s-msg', box).textContent = e.message; }
    };
  };
  draw();
  // confere a situação real no servidor quando há conta conectada
  if (cloud.status().user) strava.refreshStatus().then(() => draw()).catch(() => {});
  const off = cloud.onStatus(() => { if (!box.isConnected) { off(); return; } if (!box.querySelector('#s-import, #s-connect')) draw(); });
}

const timeAgo = t => {
  if (!t) return 'ainda não sincronizado';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'sincronizado agora' : m < 60 ? `sincronizado há ${m} min` : `sincronizado em ${new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
};

// Seção "Nuvem": login, situação da sincronização e ações
function cloudCard(box, welcome) {
  const draw = st => {
    if (!box.isConnected) return;
    if (!st.configured) {
      box.innerHTML = '<h2>Nuvem</h2><p class="small muted">A nuvem ainda não foi configurada neste app.</p>';
      return;
    }
    if (!st.user) {
      box.innerHTML = `<h2>Nuvem</h2>
        <p class="small muted">${welcome ? 'Já usa o Olimpo em outro aparelho? Entre para trazer todos os seus dados.' : 'Entre com seu e-mail para salvar tudo na nuvem automaticamente e nunca perder seus dados.'}</p>
        ${field('E-mail', '<input type="email" id="c-email" autocomplete="email" inputmode="email" autocapitalize="off">')}
        ${field('Senha (mínimo 6 caracteres)', '<input type="password" id="c-pass" autocomplete="current-password">')}
        <div class="row gap"><button class="btn grow" id="c-in">Entrar</button><button class="btn secondary grow" id="c-up">Criar conta</button></div>
        <p class="small muted" id="c-msg"></p>`;
      const go = async fn => {
        const email = $('#c-email', box).value.trim(), pass = $('#c-pass', box).value;
        const msg = $('#c-msg', box);
        if (!email || pass.length < 6) { msg.textContent = 'Informe o e-mail e uma senha de pelo menos 6 caracteres.'; return; }
        box.querySelectorAll('button').forEach(b => { b.disabled = true; });
        msg.textContent = 'Conectando…';
        try {
          const r = await fn(email, pass);
          msg.textContent = r === 'confirm' ? 'Conta criada! Abra o e-mail de confirmação que o Supabase enviou, toque no link e depois volte aqui e toque em "Entrar".' : '';
          if (r !== 'confirm') toast('Conectado à nuvem');
        } catch (e) { msg.textContent = e.message; }
        box.querySelectorAll('button').forEach(b => { b.disabled = false; });
      };
      $('#c-in', box).onclick = () => go(cloud.signIn);
      $('#c-up', box).onclick = () => go(cloud.signUp);
      return;
    }
    const line = st.phase === 'syncing' ? 'Sincronizando…'
      : st.phase === 'error' ? `⚠ ${st.error}`
        : `✓ ${timeAgo(st.last)}${st.pending ? ` · ${st.pending} alteração(ões) aguardando internet` : ''}`;
    box.innerHTML = `<h2>Nuvem</h2>
      <p class="small">Conectado como <b>${esc(st.user.email)}</b></p>
      <p class="small ${st.phase === 'error' ? '' : 'muted'}" id="c-status">${esc(line)}</p>
      <p class="small muted">Treinos, corridas, cardio, medidas, fotos, recuperação, plano e metas são salvos automaticamente.</p>
      <div class="row gap"><button class="btn secondary grow" id="c-sync" ${st.phase === 'syncing' ? 'disabled' : ''}>Sincronizar agora</button><button class="btn secondary grow" id="c-out">Sair da conta</button></div>`;
    $('#c-sync', box).onclick = () => cloud.sync({ full: true });
    $('#c-out', box).onclick = async () => {
      if (!confirm('Sair da conta neste aparelho? Seus dados continuam aqui e na nuvem.')) return;
      await cloud.signOut();
    };
  };
  const off = cloud.onStatus(st => { if (!box.isConnected) { off(); return; } draw(st); });
  draw(cloud.status());
}

export function render(el, p) {
  const pr = S.profile;
  const welcome = !pr.name;
  el.innerHTML = `
    ${welcome ? `<section class="hero"><div class="hero-num"><b>Bem-vindo!</b></div><p>Preencha seu perfil para personalizar o planejamento de musculação e corrida. Seus dados ficam salvos somente neste aparelho.</p></section>` : ''}
    <section class="card">
      <h2>Perfil</h2>
      ${field('Nome', `<input id="p-name" value="${esc(pr.name)}" autocomplete="given-name">`)}
      <div class="grid2">
        ${field('Ano de nascimento', `<input type="number" inputmode="numeric" id="p-birth" value="${esc(pr.birthYear)}">`)}
        ${field('Sexo', `<select id="p-sex"><option value=""></option><option value="F" ${pr.sex === 'F' ? 'selected' : ''}>Feminino</option><option value="M" ${pr.sex === 'M' ? 'selected' : ''}>Masculino</option><option value="O" ${pr.sex === 'O' ? 'selected' : ''}>Prefiro não informar</option></select>`)}
        ${field('Altura (cm)', `<input type="number" inputmode="numeric" id="p-height" value="${esc(pr.heightCm)}">`)}
        ${field('Peso inicial (kg)', `<input type="number" inputmode="decimal" step="0.1" id="p-weight" value="${esc(pr.weightKg)}">`)}
      </div>
      <div class="field"><span>Nível de experiência</span>${chips('level', LEVELS, pr.experience)}</div>
      <div class="field"><span>Objetivo principal</span>${chips('goal', GOALS, pr.goal)}</div>
      ${field('Início do acompanhamento', `<input type="date" id="p-start" value="${pr.startDate || todayISO()}">`)}
      <button class="btn block" id="p-save">${welcome ? 'Começar' : 'Salvar perfil'}</button>
    </section>

    <section class="card" id="cloud"></section>
    ${welcome ? '' : '<section class="card" id="strava-card"></section>'}

    ${welcome ? '' : `<section class="card">
      <h2>Backup dos dados</h2>
      <p class="small muted">Todo o histórico fica neste aparelho. Exporte um backup periodicamente para não perder seus dados (inclui fotos).</p>
      <div class="row gap wrap">
        <button class="btn secondary grow" id="p-export">Exportar backup</button>
        <label class="btn secondary grow">Importar backup<input type="file" accept="application/json,.json" id="p-import" hidden></label>
      </div>
      <button class="link muted small top" id="p-wipe">Apagar todos os dados</button>
    </section>`}
    <section class="card">
      <h2>Atualização do app</h2>
      <p class="small muted">Versão instalada: <b>${APP_VERSION}</b> · <span id="p-latest">verificando…</span></p>
      <button class="btn secondary block" id="p-update">Atualizar o app agora</button>
      <p class="small muted">Baixa a versão mais recente. Seus treinos, fotos e medidas não são apagados.</p>
    </section>`;
  bindChips(el);
  cloudCard($('#cloud', el), welcome);
  if ($('#strava-card', el)) stravaCard($('#strava-card', el));
  checkForUpdate().then(v => {
    const s = $('#p-latest', el);
    if (!s) return;
    s.textContent = v == null ? 'sem conexão para verificar' : v === APP_VERSION ? 'você está na versão mais recente' : `nova versão disponível: ${v}`;
  });
  $('#p-update', el).onclick = forceUpdate;
  $('#p-save', el).onclick = async () => {
    const name = $('#p-name', el).value.trim();
    if (!name) { toast('Informe seu nome'); return; }
    await setKV('profile', {
      ...pr, name,
      birthYear: num($('#p-birth', el).value) || '', sex: $('#p-sex', el).value,
      heightCm: num($('#p-height', el).value) || '', weightKg: num($('#p-weight', el).value) || '',
      experience: chipVal(el, 'level'), goal: chipVal(el, 'goal'),
      startDate: $('#p-start', el).value || pr.startDate,
    });
    toast('Perfil salvo');
    if (welcome) location.hash = '#/inicio';
  };
  $('#p-export', el)?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(exportAll())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `treino-backup-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#p-import', el)?.addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    if (!confirm('Importar este backup substitui todos os dados atuais. Continuar?')) return;
    try { await importAll(JSON.parse(await f.text())); toast('Backup importado'); location.hash = '#/inicio'; }
    catch (err) { toast(err.message || 'Não foi possível importar'); }
  });
  $('#p-wipe', el)?.addEventListener('click', async () => {
    if (!confirm('Apagar TODO o histórico, perfil e fotos deste aparelho? (O que já está na nuvem continua lá; você sai da conta neste aparelho.)')) return;
    if (prompt('Digite APAGAR para confirmar') !== 'APAGAR') return;
    await cloud.signOut();
    await wipe(); location.hash = '#/perfil';
  });
}

export function renderMore(el) {
  const link = (href, ic, title, sub) => `<a class="list-link" href="${href}">${icon(ic)}<div class="grow"><b>${title}</b><div class="small muted">${sub}</div></div><span class="muted">›</span></a>`;
  el.innerHTML = `<section class="card">
    ${link('#/calendario', 'cal', 'Calendário', 'Treinos feitos, pendentes e remarcações')}
    ${link('#/biblioteca', 'book', 'Biblioteca de exercícios', 'Execução, postura, erros comuns e recordes')}
    ${link('#/cardio', 'heart', 'Cardio', 'Esteira, bicicleta, elíptico, escada...')}
    ${link('#/metas', 'trophy', 'Metas e conquistas', 'Objetivos semanais e medalhas')}
    ${link('#/relatorio', 'file', 'Minha evolução (PDF)', 'Relatório por período para exportar')}
    ${link('#/recuperacao', 'moon', 'Recuperação', 'Sono, disposição, cansaço e dores')}
    ${link('#/corpo', 'body', 'Corpo e fotos', 'Peso, medidas e evolução por fotos')}
    ${link('#/plano', 'plan', 'Plano semanal', 'Dias, exercícios, metas e progressão')}
    ${link('#/perfil', 'user', 'Perfil, nuvem e backup', 'Objetivo, nível, conta na nuvem e cópia dos dados')}
  </section>
  <p class="small muted center">Treino Integrado · dados salvos somente neste aparelho</p>`;
}
