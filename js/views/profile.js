// Perfil (nível, objetivo), backup dos dados e menu "Mais".
import { S, setKV, exportAll, importAll, wipe } from '../store.js';
import { todayISO, num, esc, toast } from '../util.js';
import { $, chips, bindChips, chipVal, field, icon } from '../ui.js';
import { GOALS, LEVELS } from '../defaults.js';

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

    ${welcome ? '' : `<section class="card">
      <h2>Backup dos dados</h2>
      <p class="small muted">Todo o histórico fica neste aparelho. Exporte um backup periodicamente para não perder seus dados (inclui fotos).</p>
      <div class="row gap wrap">
        <button class="btn secondary grow" id="p-export">Exportar backup</button>
        <label class="btn secondary grow">Importar backup<input type="file" accept="application/json,.json" id="p-import" hidden></label>
      </div>
      <button class="link muted small top" id="p-wipe">Apagar todos os dados</button>
    </section>`}`;
  bindChips(el);
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
    if (!confirm('Apagar TODO o histórico, perfil e fotos deste aparelho?')) return;
    if (prompt('Digite APAGAR para confirmar') !== 'APAGAR') return;
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
    ${link('#/perfil', 'user', 'Perfil e backup', 'Objetivo, nível e cópia dos dados')}
  </section>
  <p class="small muted center">Treino Integrado · dados salvos somente neste aparelho</p>`;
}
