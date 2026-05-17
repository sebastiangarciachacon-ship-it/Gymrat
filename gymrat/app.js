// ═══ ESTADO GLOBAL ═══════════════════════════════════════════
let onboardType = '';
let coachPlan = {};
let editCtx = { dia: null, idx: -1 };
let currentDay = '', selectedMuscle = '';

const defaultPlan = {
  'Empuje': [
    { nombre: 'Press plano maq. discos', series: 4, reps: 10, nota: '' },
    { nombre: 'Press inclinado multipower', series: 4, reps: 10, nota: '' },
    { nombre: 'Apertura maq.', series: 3, reps: 12, nota: '' },
    { nombre: 'Tríceps barra', series: 4, reps: 12, nota: '' },
    { nombre: 'Tríceps barra Z', series: 3, reps: 12, nota: '' },
  ],
  'Tracción': [
    { nombre: 'Remo abierto', series: 4, reps: 10, nota: '' },
    { nombre: 'Remo agarre neutro', series: 4, reps: 10, nota: '' },
    { nombre: 'Pull over polea', series: 3, reps: 12, nota: '' },
    { nombre: 'Curl bíceps barra', series: 4, reps: 10, nota: '' },
    { nombre: 'Curl bíceps barra polea', series: 3, reps: 12, nota: '' },
  ],
  'Piernas': [
    { nombre: 'Sentadilla multipower', series: 4, reps: 10, nota: '' },
    { nombre: 'Zancada multipower', series: 3, reps: 12, nota: '' },
    { nombre: 'Prensa', series: 4, reps: 12, nota: '' },
    { nombre: 'Femoral sentado', series: 3, reps: 12, nota: '' },
    { nombre: 'Femoral tumbado', series: 3, reps: 12, nota: '' },
    { nombre: 'Abductor', series: 3, reps: 15, nota: '' },
    { nombre: 'Aductor', series: 3, reps: 15, nota: '' },
    { nombre: 'Gemelos', series: 4, reps: 15, nota: '' },
  ],
};

const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// ═══ UTILIDADES ══════════════════════════════════════════════
function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function nav(id, btn) {
  go(id);
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function badgeClass(dia) {
  const d = (dia || '').toLowerCase();
  if (d.includes('empuje')) return 'badge-empuje';
  if (d.includes('tracción') || d.includes('traccion')) return 'badge-traccion';
  if (d.includes('pierna')) return 'badge-piernas';
  if (d.includes('descanso')) return 'badge-descanso';
  return 'badge-custom';
}

function badgeText(dia) {
  return (dia || 'Descanso').split(' ')[0];
}

function setTodayDate() {
  const el = document.getElementById('today-date');
  if (el) {
    const now = new Date();
    const opts = { weekday: 'short', day: 'numeric', month: 'short' };
    el.textContent = now.toLocaleDateString('es-ES', opts);
  }
}

// ═══ ONBOARDING ══════════════════════════════════════════════
function pick(card, type) {
  document.querySelectorAll('.opt-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  onboardType = type;
  document.getElementById('ob-btn').disabled = false;
}

function continueOnboard() {
  if (onboardType === 'coach') {
    go('s-import');
  } else {
    coachPlan = JSON.parse(JSON.stringify(defaultPlan));
    renderAgenda();
    renderMyPlan();
    go('s-agenda');
  }
}

// ═══ IMPORT ══════════════════════════════════════════════════
function resetImport() {
  document.getElementById('upload-zone').style.display = 'block';
  document.getElementById('divider-or').style.display = 'flex';
  document.getElementById('skip-btn').style.display = 'block';
  document.getElementById('ai-status').style.display = 'none';
  document.getElementById('ai-result').style.display = 'none';
  document.getElementById('file-input').value = '';
}

async function handleFile(input) {
  const file = input.files[0];
  if (!file) return;

  document.getElementById('upload-zone').style.display = 'none';
  document.getElementById('divider-or').style.display = 'none';
  document.getElementById('skip-btn').style.display = 'none';
  document.getElementById('ai-status').style.display = 'block';

  const b64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const isImage = file.type.startsWith('image/');
  const contentBlock = isImage
    ? { type: 'image', source: { type: 'base64', media_type: file.type, data: b64 } }
    : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } };

  const prompt = `Eres un asistente experto en fitness. Analiza este plan de entrenamiento de un entrenador personal.

Tu tarea:
1. Identifica los días/bloques de entrenamiento
2. Para cada bloque extrae ejercicios con series y repeticiones
3. Usa nombres limpios sin "Día 1", "Día 2" — solo el tipo: "Empuje", "Tracción", "Piernas", "Hombros", "Brazos", "Full Body", etc.

Devuelve ÚNICAMENTE este JSON sin texto extra ni backticks:
{"dias":[{"nombre":"Empuje","ejercicios":[{"nombre":"nombre ejercicio","series":4,"reps":10,"nota":""}]}]}

Si hay rango de reps usa el mayor. Sin series/reps claras pon 3 series 10 reps.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }]
      })
    });
    const data = await resp.json();
    const text = data.content.filter(c => c.type === 'text').map(c => c.text).join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    coachPlan = {};
    (parsed.dias || []).forEach(d => {
      coachPlan[d.nombre] = d.ejercicios.map(e => ({
        nombre: e.nombre, series: e.series || 3, reps: e.reps || 10, nota: e.nota || '', motivo: ''
      }));
    });
  } catch (e) {
    coachPlan = JSON.parse(JSON.stringify(defaultPlan));
  }

  document.getElementById('ai-status').style.display = 'none';
  renderAIResult();
  document.getElementById('ai-result').style.display = 'block';
}

function renderAIResult() {
  const box = document.getElementById('ai-box');
  const dias = Object.entries(coachPlan);
  let html = `<div class="ai-label"><i class="ti ti-sparkles"></i> ${dias.length} bloques detectados — revisa y edita</div>`;
  dias.forEach(([dia, exs]) => {
    html += `<div class="day-section">
      <div class="day-section-title">${dia} · ${exs.length} ejercicios</div>`;
    exs.forEach((ex, i) => {
      html += `<div class="ai-ex-row">
        <div>
          <div class="ai-ex-name">${ex.nombre}</div>
          <div class="ai-ex-detail">${ex.series} series × ${ex.reps} reps${ex.nota ? ' · ' + ex.nota : ''}</div>
        </div>
        <button class="edit-btn" onclick="openModal('${dia.replace(/'/g, "\\'")}', ${i})">
          <i class="ti ti-edit" style="font-size:12px;vertical-align:-1px;"></i> Editar
        </button>
      </div>`;
    });
    html += '</div>';
  });
  box.innerHTML = html;
}

function savePlan() {
  renderAgenda();
  renderMyPlan();
  go('s-agenda');
}

// ═══ AGENDA ══════════════════════════════════════════════════
function renderAgenda() {
  const dias = Object.keys(coachPlan);
  const container = document.getElementById('agenda-days');
  const today = new Date().getDay(); // 0=dom, 1=lun...
  const todayIdx = today === 0 ? 6 : today - 1; // convert to Mon=0
  let html = '';

  weekDays.forEach((wd, i) => {
    const isToday = i === todayIdx;
    let planDia = 'Descanso';
    if (dias.length > 0) {
      const workoutDays = [0, 1, 2, 4]; // L, M, X, V
      const wdIdx = workoutDays.indexOf(i);
      if (wdIdx >= 0 && wdIdx < dias.length) planDia = dias[wdIdx];
    }
    const bc = badgeClass(planDia);
    const bt = badgeText(planDia);
    html += `<div class="day-card${isToday ? ' today' : ''}" onclick="openDay('${wd}', '${planDia.replace(/'/g, "\\'")}')">
      <div>
        <div class="day-label">${wd}${isToday ? ' · Hoy' : ''}</div>
        <div class="day-name">${planDia}</div>
      </div>
      <span class="badge ${bc}">${bt}</span>
    </div>`;
  });
  container.innerHTML = html;
}

// ═══ MI PLAN ═════════════════════════════════════════════════
function renderMyPlan() {
  const c = document.getElementById('myplan-content');
  const dias = Object.entries(coachPlan);
  if (!dias.length) {
    c.innerHTML = `<div style="text-align:center;padding:60px 0;color:var(--text-2);">
      <i class="ti ti-file-off" style="font-size:48px;display:block;margin-bottom:12px;"></i>
      <div style="font-size:16px;font-weight:600;">Aún no has subido ningún plan</div>
      <p style="font-size:14px;margin-top:6px;">Sube el plan de tu entrenador para empezar.</p>
      <button class="btn-primary mt16" onclick="go('s-import')">Subir plan</button>
    </div>`;
    return;
  }
  let html = `<p style="font-size:13px;color:var(--text-2);margin-bottom:16px;">Toca cualquier ejercicio para editarlo.</p>`;
  dias.forEach(([dia, exs]) => {
    html += `<div style="margin-bottom:20px;">
      <div class="plan-day-header">
        <span>${dia}</span>
        <span style="font-size:12px;font-weight:500;">${exs.length} ejercicios</span>
      </div>`;
    exs.forEach((ex, i) => {
      html += `<div class="ex-card" style="cursor:pointer;margin-bottom:8px;" onclick="openModal('${dia.replace(/'/g, "\\'")}', ${i})">
        <div class="ex-top" style="margin-bottom:0;">
          <div>
            <div class="ex-name">${ex.nombre}</div>
            <div style="font-size:13px;color:var(--text-2);margin-top:3px;">${ex.series} series × ${ex.reps} reps${ex.motivo ? ' · ' + ex.motivo : ''}</div>
          </div>
          <button class="info-btn" onclick="event.stopPropagation();openModal('${dia.replace(/'/g, "\\'")}', ${i})">
            <i class="ti ti-edit"></i>
          </button>
        </div>
      </div>`;
    });
    html += '</div>';
  });
  html += `<button class="btn-secondary mt8" onclick="go('s-import')">
    <i class="ti ti-upload" style="font-size:14px;vertical-align:-2px;margin-right:6px;"></i>Actualizar plan
  </button>`;
  c.innerHTML = html;
}

// ═══ SELECTOR DÍA ════════════════════════════════════════════
function openDay(day, planDia) {
  currentDay = day;
  selectedMuscle = planDia;
  document.getElementById('sel-sub').textContent = day;

  const bc = badgeClass(planDia);
  const bt = badgeText(planDia);
  document.getElementById('default-muscle').innerHTML = `
    <div style="background:var(--bg);border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:15px;font-weight:600;color:var(--text);">${planDia}</span>
      <span class="badge ${bc}">${bt}</span>
    </div>`;

  const allOptions = [...Object.keys(coachPlan)];
  if (!allOptions.includes('Descanso')) allOptions.push('Descanso');

  document.getElementById('muscle-grid').innerHTML = allOptions.map(m => {
    const isRest = m === 'Descanso';
    const count = isRest ? '— recuperación' : `${(coachPlan[m] || []).length} ejercicios`;
    return `<button class="muscle-btn${m === planDia ? ' selected' : ''}${isRest ? ' rest' : ''}" onclick="selectMuscle('${m.replace(/'/g, "\\'")}', this)">
      <div class="muscle-label">${isRest ? '<i class="ti ti-bed" style="font-size:15px;vertical-align:-2px;margin-right:5px;"></i>' : ''}${m}</div>
      <div class="muscle-count">${count}</div>
    </button>`;
  }).join('');

  go('s-selector');
}

function selectMuscle(m, btn) {
  selectedMuscle = m;
  document.querySelectorAll('.muscle-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

// ═══ WORKOUT ═════════════════════════════════════════════════
function startWorkout() {
  if (selectedMuscle === 'Descanso') { go('s-rest'); return; }
  const exs = coachPlan[selectedMuscle] || [];
  if (!exs.length) { go('s-agenda'); return; }

  document.getElementById('wk-sub').textContent = currentDay;
  document.getElementById('wk-title').textContent = selectedMuscle;

  let html = '';
  exs.forEach(ex => {
    const pid = 'p' + Math.random().toString(36).slice(2, 7);
    const ytLink = `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.nombre + ' técnica gimnasio')}`;
    html += `<div class="ex-card">
      <div class="ex-top">
        <div>
          <div class="ex-name">${ex.nombre}</div>
          ${ex.nota ? `<div class="ex-note"><i class="ti ti-settings-2" style="font-size:12px;"></i>${ex.nota}</div>` : ''}
        </div>
        <button class="info-btn" onclick="toggleInfo('${pid}')">
          <i class="ti ti-info-circle"></i> Info
        </button>
      </div>
      <div class="info-panel" id="${pid}">
        <div class="info-desc">Realiza el movimiento de forma controlada. Mantén la postura correcta durante toda la serie. Descansa 60–90 segundos entre series.</div>
        <a class="info-link" href="${ytLink}" target="_blank">
          <i class="ti ti-brand-youtube" style="color:#ff0000;font-size:16px;"></i> Ver vídeo técnico
        </a>
      </div>
      ${Array.from({ length: ex.series }, (_, i) => `
        <div class="series-row">
          <span class="ser-label">Serie ${i + 1}</span>
          <input class="ser-input" type="number" value="0" placeholder="kg">
          <span class="ser-x">kg ×</span>
          <input class="ser-input" type="number" value="${ex.reps}" placeholder="reps">
          <span class="ser-x">reps</span>
        </div>`).join('')}
      <button class="add-ser" onclick="addSerie(this)">
        <i class="ti ti-plus"></i> Añadir serie
      </button>
      <div class="note-row">
        <i class="ti ti-note" style="font-size:16px;color:var(--text-3);"></i>
        <input class="note-input" type="text" placeholder="Ajuste de máquina, pin, altura..." value="${ex.nota || ''}">
      </div>
    </div>`;
  });
  html += `<button class="btn-primary mt8" style="margin-bottom:24px;" onclick="openDiary()">Finalizar entreno →</button>`;
  document.getElementById('wk-content').innerHTML = html;
  go('s-workout');
}

function toggleInfo(id) { document.getElementById(id).classList.toggle('open'); }

function addSerie(btn) {
  const card = btn.closest('.ex-card');
  const rows = card.querySelectorAll('.series-row');
  const n = rows.length + 1;
  const row = document.createElement('div');
  row.className = 'series-row';
  row.innerHTML = `<span class="ser-label">Serie ${n}</span><input class="ser-input" type="number" value="0" placeholder="kg"><span class="ser-x">kg ×</span><input class="ser-input" type="number" value="10" placeholder="reps"><span class="ser-x">reps</span>`;
  card.insertBefore(row, btn);
}

// ═══ DIARIO ══════════════════════════════════════════════════
function openDiary() {
  const notes = document.querySelectorAll('#wk-content .note-input');
  const names = document.querySelectorAll('#wk-content .ex-name');
  let html = '';
  notes.forEach((n, i) => {
    if (n.value.trim()) {
      html += `<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border);">
        <i class="ti ti-settings-2" style="font-size:16px;color:var(--green);margin-top:1px;"></i>
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--text);">${names[i] ? names[i].textContent : ''}</div>
          <div style="font-size:13px;color:var(--text-2);margin-top:2px;">${n.value}</div>
        </div>
      </div>`;
    }
  });
  if (!html) html = `<p style="font-size:14px;color:var(--text-2);">No añadiste ajustes de máquina en esta sesión.</p>`;
  document.getElementById('machine-notes').innerHTML = html;
  go('s-diary');
}

function setInt(btn) {
  document.querySelectorAll('.int-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ═══ MODAL EDITAR ════════════════════════════════════════════
function openModal(dia, idx) {
  editCtx = { dia, idx };
  const ex = coachPlan[dia][idx];
  document.getElementById('edit-name').value = ex.nombre;
  document.getElementById('edit-sets').value = ex.series;
  document.getElementById('edit-reps').value = ex.reps;
  document.getElementById('edit-note').value = ex.nota || '';
  document.querySelectorAll('.reason-tag').forEach(t => t.classList.remove('active'));
  if (ex.motivo) {
    document.querySelectorAll('.reason-tag').forEach(t => {
      if (t.textContent === ex.motivo) t.classList.add('active');
    });
  }
  document.getElementById('edit-modal').classList.add('open');
}

function closeModal() { document.getElementById('edit-modal').classList.remove('open'); }

function toggleReason(tag) {
  document.querySelectorAll('.reason-tag').forEach(t => t.classList.remove('active'));
  tag.classList.add('active');
}

function saveEdit() {
  const { dia, idx } = editCtx;
  const motivo = document.querySelector('.reason-tag.active')?.textContent || '';
  coachPlan[dia][idx] = {
    nombre: document.getElementById('edit-name').value,
    series: parseInt(document.getElementById('edit-sets').value) || 3,
    reps: parseInt(document.getElementById('edit-reps').value) || 10,
    nota: document.getElementById('edit-note').value,
    motivo
  };
  closeModal();
  renderAIResult();
  renderMyPlan();
}

function deleteEx() {
  const { dia, idx } = editCtx;
  coachPlan[dia].splice(idx, 1);
  closeModal();
  renderAIResult();
  renderMyPlan();
}

// ═══ GRÁFICA ═════════════════════════════════════════════════
function renderChart() {
  const barData = [
    { d: 'L', v: 3.2 }, { d: 'M', v: 2.8 }, { d: 'X', v: 4.1 },
    { d: 'J', v: 0 }, { d: 'V', v: 3.3 }, { d: 'S', v: 2.6 }, { d: 'D', v: 0 }
  ];
  const maxV = Math.max(...barData.map(d => d.v), 1);
  const bc = document.getElementById('bar-chart');
  if (!bc) return;
  barData.forEach((d, i) => {
    const h = d.v > 0 ? Math.round((d.v / maxV) * 70) : 4;
    const col = document.createElement('div');
    col.className = 'bar-col';
    col.innerHTML = `<div style="font-size:11px;color:var(--text-2);font-weight:500;">${d.v > 0 ? d.v + 't' : ''}</div>
      <div class="bar${i === 6 ? ' today' : ''}" style="height:${h}px;"></div>
      <div style="font-size:11px;color:var(--text-2);font-weight:500;">${d.d}</div>`;
    bc.appendChild(col);
  });
}

// ═══ INIT ════════════════════════════════════════════════════
setTodayDate();
renderChart();
renderMyPlan();
renderAgenda();
